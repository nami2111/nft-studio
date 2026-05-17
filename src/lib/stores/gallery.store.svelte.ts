/**
 * Gallery Store - State management for gallery functionality
 * Uses Svelte 5 runes and durable storage for persistence
 */

import type {
	GalleryItem,
	GalleryCollection,
	GalleryState,
	GalleryFilterOptions,
	GallerySortOption
} from '$lib/types/gallery';
import { untrack } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
import { runIndexedDbToOpfsMigration } from '$lib/storage/migrations';
import {
	getAllCollections,
	saveCollection,
	saveItemImage,
	getItemImage as fetchItemImage,
	deleteCollection,
	clearAllCollections,
	getStorageEstimate
} from '$lib/utils/gallery-storage';
import { imageUrlCache } from '$lib/utils/object-url-cache';
import { debugLog, debugTime, debugCount } from '$lib/utils/simple-debug';
import { PERF_CONFIG } from '$lib/config/performance.config';
import { productionMonitor } from '$lib/monitoring/performance-monitor';

const SELECTED_COLLECTION_STORAGE_KEY = 'gnstudio-gallery-selected-collection';

// Gallery store with Svelte 5 runes
class GalleryStore {
	// LRU cache for filtered results - tracks access for efficient eviction
	private filteredCache = new Map<string, GalleryItem[]>();
	private readonly MAX_CACHE_ENTRIES = PERF_CONFIG.cache.galleryFilter.maxEntries;

	// Debounce timer for saves
	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly SAVE_DEBOUNCE_MS = 1000; // 1 second debounce for gallery saves

	// Natural numeric sorting function for names
	private naturalCompare(a: string, b: string): number {
		// Extract numbers from anywhere in the string (handles "Foxinity #1", "#001", etc.)
		const extractNumber = (str: string): { num: number | null; index: number } => {
			// Try to find number after common delimiters like #, -, space
			const match = str.match(/(?:[#\-\s:_]\s*)(\d+)/);
			if (match) {
				return { num: parseInt(match[1], 10), index: match.index || 0 };
			}
			// Try to find number at the very start
			const startMatch = str.match(/^(\d+)/);
			if (startMatch) {
				return { num: parseInt(startMatch[1], 10), index: 0 };
			}
			return { num: null, index: -1 };
		};

		const aNum = extractNumber(a);
		const bNum = extractNumber(b);

		// If both have numbers, compare numerically
		if (aNum.num !== null && bNum.num !== null) {
			if (aNum.num !== bNum.num) {
				return aNum.num - bNum.num;
			}
			// If numbers are equal, use standard string comparison
			return a.localeCompare(b);
		}
		// If only one has a number, prioritize the one with numbers
		if (aNum.num !== null) return -1;
		if (bNum.num !== null) return 1;
		// Otherwise, use standard string comparison
		return a.localeCompare(b);
	}

	/**
	 * Build a trait index for efficient O(1) filtering
	 * The index maps "layer:trait" identifying strings to a Set of item IDs that possess them
	 * This allows for near-instant set intersection filtering instead of O(N) scanning
	 */
	private buildTraitIndex(items: GalleryItem[]): {
		index: SvelteMap<string, SvelteSet<string>>;
		categories: SvelteMap<string, string[]>;
	} {
		const startTiming = debugTime('Build trait index');
		const index = new SvelteMap<string, SvelteSet<string>>();
		const traitStats = new SvelteMap<string, SvelteSet<string>>();

		// Use untrack and avoid reactive overhead - this is critical for loop performance in Svelte 5
		untrack(() => {
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				const traits = item.metadata?.traits || [];
				for (let j = 0; j < traits.length; j++) {
					const trait = traits[j];
					const layer = trait.layer || ((trait as Record<string, unknown>).trait_type as string);
					const value = trait.trait || ((trait as Record<string, unknown>).value as string);

					if (layer && value) {
						const key = `${layer}:${value}`;

						// Update inverse index
						if (!index.has(key)) {
							index.set(key, new SvelteSet());
						}
						index.get(key)!.add(item.id);

						// Update categories for UI
						if (!traitStats.has(layer)) {
							traitStats.set(layer, new SvelteSet());
						}
						traitStats.get(layer)!.add(value);
					}
				}
			}
		});

		// Format categories for UI (sorting values)
		const categories = new SvelteMap<string, string[]>();
		for (const [layer, values] of traitStats.entries()) {
			categories.set(layer, Array.from(values).sort());
		}

		debugCount('Trait index categories', index.size);
		startTiming();
		return { index, categories };
	}

	// Track last logged storage usage to reduce log frequency
	private _lastLoggedUsage: number | null = null;

	// Trait index cache for efficient filtering - maps "layer:trait" to a Set of item IDs
	private _traitIndex = new SvelteMap<string, SvelteSet<string>>();
	private _traitCategories = new SvelteMap<string, string[]>();
	private _traitIndexCollectionId: string | null = null;

	// Main state
	private _state = $state<GalleryState>({
		collections: [],
		selectedItem: null,
		selectedCollection: null,
		filterOptions: {},
		sortOption: 'newest',
		isLoading: false,
		streamProgress: 0,
		streamMessage: '',
		error: null
	});

	// Getters
	get collections() {
		return this._state.collections;
	}

	get selectedItem() {
		return this._state.selectedItem;
	}

	get selectedCollection() {
		return this._state.selectedCollection;
	}

	get filterOptions() {
		return this._state.filterOptions;
	}

	get sortOption() {
		return this._state.sortOption;
	}

	get isLoading() {
		return this._state.isLoading;
	}

	get error() {
		return this._state.error;
	}

	get streamProgress() {
		return this._state.streamProgress;
	}

	get streamMessage() {
		return this._state.streamMessage;
	}

	get allTraits() {
		return Object.fromEntries(this._traitCategories.entries());
	}

	private persistSelectedCollection(collectionId: string | null): void {
		if (typeof localStorage === 'undefined') {
			return;
		}

		if (collectionId) {
			localStorage.setItem(SELECTED_COLLECTION_STORAGE_KEY, collectionId);
		} else {
			localStorage.removeItem(SELECTED_COLLECTION_STORAGE_KEY);
		}
	}

	// Fast filtered and sorted items with simple caching
	get filteredAndSortedItems(): GalleryItem[] {
		const endTiming = debugTime('Gallery Filter Process');

		// Get source items
		let sourceItems: GalleryItem[] = [];
		if (this._state.selectedCollection) {
			sourceItems = this._state.selectedCollection.items;
		} else {
			sourceItems = this._state.collections.flatMap((collection) => collection.items);
		}
		debugCount('Source Items', sourceItems.length);

		// Create cache key
		const filterKey = this.createFilterKey();

		// Check cache first
		if (this.filteredCache.has(filterKey)) {
			debugLog('🎯 CACHE HIT! Using cached results');
			// Mark as recently used by re-inserting (LRU)
			const cached = this.filteredCache.get(filterKey)!;
			this.filteredCache.delete(filterKey);
			this.filteredCache.set(filterKey, cached);
			// Record cache hit in production monitor
			productionMonitor.recordCacheHit('galleryFilter');
			endTiming();
			return cached;
		}

		debugLog('❌ CACHE MISS - Running full filter process');
		// Record cache miss in production monitor
		productionMonitor.recordCacheMiss('galleryFilter');

		// Perform filtering
		let filtered = [...sourceItems];

		// Apply search filter
		if (this._state.filterOptions.search) {
			debugLog('🔍 Applying search filter');
			const searchLower = this._state.filterOptions.search.toLowerCase();
			filtered = filtered.filter(
				(item) =>
					item.name.toLowerCase().includes(searchLower) ||
					item.description?.toLowerCase().includes(searchLower)
			);
			debugCount('After search filter', filtered.length);
		}

		// Apply trait filters using pre-computed index (O(1) lookups instead of O(n*m*k))
		if (this._state.filterOptions.selectedTraits) {
			debugLog('🏷️ Applying trait filters with index');

			// Build trait index once per collection
			const currentCollectionId = this._state.selectedCollection?.id || 'all';
			if (this._traitIndexCollectionId !== currentCollectionId || this._traitIndex.size === 0) {
				const { index, categories } = this.buildTraitIndex(sourceItems);
				this._traitIndex = index;
				this._traitCategories = categories;
				this._traitIndexCollectionId = currentCollectionId;
			}

			// Use the inverse index for high-performance set intersection
			const selectedTraitOptions = Object.entries(this._state.filterOptions.selectedTraits!).filter(
				([, values]) => values.length > 0
			);

			if (selectedTraitOptions.length > 0) {
				let candidateIds: SvelteSet<string> | null = null;

				for (const [layer, values] of selectedTraitOptions) {
					// Collect all item IDs that match ANY of the selected traits in this layer (OR logic)
					const layerMatchIds = new SvelteSet<string>();
					for (const value of values) {
						const matches = this._traitIndex.get(`${layer}:${value}`);
						if (matches) {
							for (const id of matches) {
								layerMatchIds.add(id);
							}
						}
					}

					// Intersect with candidateIds (AND logic across layers)
					if (candidateIds === null) {
						candidateIds = layerMatchIds;
					} else {
						// Faster intersection: iterate over the smaller set
						const smaller = candidateIds.size < layerMatchIds.size ? candidateIds : layerMatchIds;
						const larger = smaller === candidateIds ? layerMatchIds : candidateIds;
						const intersected = new SvelteSet<string>();

						for (const id of smaller) {
							if (larger.has(id)) {
								intersected.add(id);
							}
						}
						candidateIds = intersected;
					}

					// Optimization: If no candidates left, stop early
					if (candidateIds.size === 0) break;
				}

				const finalIds = candidateIds || new SvelteSet<string>();
				filtered = filtered.filter((item) => finalIds.has(item.id));
			}
			debugCount('After trait filters', filtered.length);
		}

		// Apply rarity range filter
		if (this._state.filterOptions.rarityRange) {
			debugLog('⭐ Applying rarity filter');
			const [min, max] = this._state.filterOptions.rarityRange;
			filtered = filtered.filter((item) => item.rarityScore >= min && item.rarityScore <= max);
			debugCount('After rarity filter', filtered.length);
		}

		// Apply sorting
		debugLog('📊 Applying sorting');
		switch (this._state.sortOption) {
			case 'name-asc':
				filtered.sort((a, b) => this.naturalCompare(a.name, b.name));
				break;
			case 'name-desc':
				filtered.sort((a, b) => this.naturalCompare(b.name, a.name));
				break;
			case 'rarity-asc':
				filtered.sort((a, b) => a.rarityRank - b.rarityRank);
				break;
			case 'rarity-desc':
				filtered.sort((a, b) => b.rarityRank - a.rarityRank);
				break;
			case 'newest':
				filtered.sort(
					(a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
				);
				break;
			case 'oldest':
				filtered.sort(
					(a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
				);
				break;
		}

		// Cache result with LRU eviction
		if (this.filteredCache.size >= this.MAX_CACHE_ENTRIES) {
			// Remove the least recently used item (first key in Map)
			const firstKey = this.filteredCache.keys().next().value;
			if (firstKey) {
				this.filteredCache.delete(firstKey);
				// Record cache eviction in production monitor
				productionMonitor.recordCacheEviction('galleryFilter', 0);
			}
		}
		this.filteredCache.set(filterKey, filtered);
		// Update cache memory usage in production monitor
		productionMonitor.updateCacheMemoryUsage('galleryFilter', this.filteredCache.size * 1024);

		debugCount('✅ FINAL RESULT', filtered.length);
		endTiming();
		return filtered;
	}

	/**
	 * Create cache key for current filters
	 * Uses immutable collection ID only - never includes mutable count
	 */
	private createFilterKey(): string {
		const search = this._state.filterOptions.search || '';
		const traits = this._state.filterOptions.selectedTraits
			? JSON.stringify(Object.entries(this._state.filterOptions.selectedTraits).sort())
			: '';
		const rarity = this._state.filterOptions.rarityRange
			? `${this._state.filterOptions.rarityRange[0]}-${this._state.filterOptions.rarityRange[1]}`
			: '';
		const sort = this._state.sortOption;
		const collection = this._state.selectedCollection?.id || 'all';

		return `${collection}:${search}:${traits}:${rarity}:${sort}`;
	}

	// Actions
	setSelectedItem(item: GalleryItem | null) {
		this._state.selectedItem = item;
	}

	setSelectedCollection(collection: GalleryCollection | null) {
		untrack(() => {
			this._state.selectedCollection = collection;
			this._state.selectedItem = null; // Clear selected item when changing collection
			// Clear trait index when switching collections
			this._traitIndex.clear();
			this._traitIndexCollectionId = null;
			this.persistSelectedCollection(collection?.id ?? null);
		});
	}

	setFilterOptions(options: Partial<GalleryFilterOptions>) {
		untrack(() => {
			this._state.filterOptions = { ...this._state.filterOptions, ...options };
			// Clear cache when filters change
			this.filteredCache.clear();
			// NOTE: We no longer clear trait index here! It's built once per collection.
		});
	}

	setSortOption(option: GallerySortOption) {
		untrack(() => {
			this._state.sortOption = option;
			// Clear cache when sort changes
			this.filteredCache.clear();
		});
	}

	setLoading(loading: boolean) {
		this._state.isLoading = loading;
	}

	setError(error: string | null) {
		this._state.error = error;
	}

	setStreamProgress(progress: number, message: string) {
		this._state.streamProgress = progress;
		this._state.streamMessage = message;
	}

	// Collection management
	addCollection(collection: GalleryCollection) {
		this._state.collections.push(collection);
		this.debouncedSaveToStorage();
	}

	updateCollection(id: string, updates: Partial<GalleryCollection>) {
		const index = this._state.collections.findIndex((c) => c.id === id);
		if (index !== -1) {
			this._state.collections[index] = { ...this._state.collections[index], ...updates };
			this.debouncedSaveToStorage();
		}
	}

	async removeCollection(id: string) {
		this._state.collections = this._state.collections.filter((c) => c.id !== id);
		if (this._state.selectedCollection?.id === id) {
			this._state.selectedCollection = null;
			this._state.selectedItem = null;
		}
		// Clear cache entries for removed collection
		this.clearCollectionCache(id);
		// Delete from durable storage.
		await deleteCollection(id);
		this.debouncedSaveToStorage();
	}

	/**
	 * Clear cache entries associated with a specific collection
	 */
	private clearCollectionCache(collectionId: string): void {
		// Clear filtered cache entries that reference this collection
		for (const key of this.filteredCache.keys()) {
			if (key.startsWith(`${collectionId}:`) || key.startsWith('all:')) {
				this.filteredCache.delete(key);
			}
		}
		// Clear trait index if it was built for this collection
		if (this._traitIndexCollectionId === collectionId) {
			this._traitIndex.clear();
			this._traitCategories.clear();
			this._traitIndexCollectionId = null;
		}
	}

	// Storage operations
	private debouncedSaveToStorage() {
		// Clear any pending save
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		// Schedule a new save with debounce
		this.saveTimeout = setTimeout(() => {
			void this.saveToStorage();
		}, this.SAVE_DEBOUNCE_MS);
	}

	private async saveToStorage() {
		// Clear any pending save
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}

		try {
			// Save all collections in parallel for better performance
			const savePromises = this._state.collections.map((collection) => saveCollection(collection));
			await Promise.all(savePromises);

			// Free RAM: null out imageData for all items now that images are on disk
			untrack(() => {
				for (const collection of this._state.collections) {
					for (const item of collection.items) {
						if (item.imageData instanceof ArrayBuffer) {
							item.imageData = new ArrayBuffer(0);
						}
					}
				}
			});

			// Save selected collection ID to localStorage (small, safe)
			this.persistSelectedCollection(this._state.selectedCollection?.id ?? null);

			// Log storage usage for monitoring
			const estimate = await getStorageEstimate();
			if (estimate.quota > 0) {
				const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
				// Only log storage when usage changes significantly (>1MB)
				const usage = parseFloat(usageMB);
				if (!this._lastLoggedUsage || Math.abs(usage - this._lastLoggedUsage) > 1) {
					this._lastLoggedUsage = usage;
				}
			}
		} catch (error) {
			console.error('Failed to save gallery data:', error);
			this.setError('Failed to save gallery data');
		}
	}

	/**
	 * Load durable gallery data into the store.
	 */
	async loadFromStorage(): Promise<void> {
		if (this._state.collections.length > 0) {
			return;
		}

		this.setLoading(true);
		this.setError(null);

		try {
			await runIndexedDbToOpfsMigration().catch((error) => {
				console.warn('IndexedDB to OPFS migration failed; using gallery fallback readers', error);
			});
			const collections = await getAllCollections();
			const selectedCollectionId =
				typeof localStorage !== 'undefined'
					? localStorage.getItem(SELECTED_COLLECTION_STORAGE_KEY)
					: null;
			const selectedCollection =
				collections.find((collection) => collection.id === selectedCollectionId) ??
				collections[0] ??
				null;

			untrack(() => {
				this._state.collections = collections;
				this._state.selectedCollection = selectedCollection;
				this._state.selectedItem = selectedCollection?.items[0] ?? null;
				this._traitIndex.clear();
				this._traitCategories.clear();
				this._traitIndexCollectionId = null;
				this.filteredCache.clear();
				imageUrlCache.setCollectionSize(
					collections.reduce((sum, collection) => sum + collection.totalSupply, 0)
				);
			});
		} catch (error) {
			console.error('Failed to load gallery data:', error);
			this.setError('Failed to load gallery data');
		} finally {
			this.setLoading(false);
		}
	}
	/**
	 * Import collection from external data (ZIP file, etc.) — streaming import.
	 * Creates a collection with metadata-only items (no imageData), calculates rarity,
	 * and stores in $state. Caller streams images individually via streamItemImage().
	 */
	createStreamingCollection(
		metadataItems: Array<{
			name: string;
			traits: Array<{ layer: string; trait: string; rarity: number }>;
			description?: string;
			imageFormat?: string;
		}>,
		collectionName: string,
		collectionDescription: string = 'Imported collection'
	): GalleryCollection {
		let finalName = collectionName;
		let counter = 1;
		while (this._state.collections.some((c) => c.name === finalName)) {
			finalName = `${collectionName} (${counter})`;
			counter++;
		}

		const collectionId = `collection-${Date.now()}`;

		const collection: GalleryCollection = {
			id: collectionId,
			name: finalName,
			description: collectionDescription,
			projectName: finalName,
			items: metadataItems.map((item, index) => ({
				id: `item-${collectionId}-${index}`,
				name: item.name,
				imageData: new ArrayBuffer(0),
				imageFormat: item.imageFormat || 'png',
				metadata: {
					traits: item.traits,
					description: item.description || ''
				},
				rarityScore: 0,
				rarityRank: 0,
				collectionId,
				generatedAt: new Date()
			})),
			generatedAt: new Date(),
			totalSupply: metadataItems.length
		};

		imageUrlCache.setCollectionSize(metadataItems.length);

		const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
		this.addCollection(updatedCollection);
		return updatedCollection;
	}

	/**
	 * Stream a single item image directly to storage during import.
	 * Updates the item's imageFormat in $state.
	 */
	async streamItemImage(
		collectionId: string,
		itemId: string,
		imageData: ArrayBuffer,
		imageFormat: string
	): Promise<void> {
		await saveItemImage(itemId, collectionId, imageData);
		const collection = this._state.collections.find((c) => c.id === collectionId);
		if (collection) {
			const item = collection.items.find((i) => i.id === itemId);
			if (item) {
				item.imageFormat = imageFormat;
				this.debouncedSaveToStorage();
			}
		}
	}

	/**
	 * Fetch a single item's image data from storage on demand.
	 */
	async getItemImage(itemId: string): Promise<ArrayBuffer | null> {
		return fetchItemImage(itemId);
	}

	/**
	 * Import collection from external data (ZIP file, etc.)
	 */
	importCollection(
		items: Array<{
			name: string;
			imageData: ArrayBuffer | string;
			metadata: Record<string, unknown>;
			index: number;
			isBlobUrl?: boolean;
			imageFormat?: string;
		}>,
		collectionName: string,
		collectionDescription: string = 'Imported collection'
	) {
		// Check for duplicate collection names
		let finalName = collectionName;
		let counter = 1;
		while (this._state.collections.some((c) => c.name === finalName)) {
			finalName = `${collectionName} (${counter})`;
			counter++;
		}

		const collectionId = `collection-${Date.now()}`;

		const collection: GalleryCollection = {
			id: collectionId,
			name: finalName,
			description: collectionDescription,
			projectName: finalName,
			items: items.map((item, index) => ({
				id: `item-${collectionId}-${index}`,
				name: item.name,
				imageData: item.imageData,
				imageFormat: item.imageFormat || 'png', // Default to png if not provided
				metadata: item.metadata as GalleryItem['metadata'],
				rarityScore: 0, // Will be calculated
				rarityRank: 0, // Will be calculated
				collectionId: collectionId,
				generatedAt: new Date()
			})),
			generatedAt: new Date(),
			totalSupply: items.length
		};

		// Set cache strategy based on collection size
		imageUrlCache.setCollectionSize(items.length);

		// Calculate rarity using proper algorithm
		const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
		this.addCollection(updatedCollection);
		return updatedCollection;
	}

	// Utility methods
	async clearGallery() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}

		this._state.collections = [];
		this._state.selectedItem = null;
		this._state.selectedCollection = null;
		this._traitIndex.clear();
		this._traitCategories.clear();
		this._traitIndexCollectionId = null;
		this.filteredCache.clear();
		// Clear durable storage and localStorage.
		await clearAllCollections();
		this.persistSelectedCollection(null);
	}

	exportCollection(collectionId: string) {
		const collection = this._state.collections.find((c) => c.id === collectionId);
		if (!collection) {
			throw new Error('Collection not found');
		}
		return collection;
	}
}

// Create singleton instance
export const galleryStore = new GalleryStore();
