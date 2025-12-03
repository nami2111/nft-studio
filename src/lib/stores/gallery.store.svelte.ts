/**
 * Gallery Store - State management for NFT gallery functionality
 * Uses Svelte 5 runes and IndexedDB for persistence
 */

import type {
	GalleryNFT,
	GalleryCollection,
	GalleryState,
	GalleryFilterOptions,
	GallerySortOption
} from '$lib/types/gallery';
import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
import {
	initGalleryDB,
	saveCollection,
	getCollection,
	getAllCollections,
	deleteCollection,
	clearAllCollections,
	getStorageEstimate
} from '$lib/utils/gallery-db';
import { imageUrlCache } from '$lib/utils/object-url-cache';
import { debugLog, debugTime, debugCount } from '$lib/utils/simple-debug';
import { PERF_CONFIG } from '$lib/config/performance.config';
import { productionMonitor } from '$lib/monitoring/performance-monitor';

// Gallery store with Svelte 5 runes
class GalleryStore {
	// LRU cache for filtered results - tracks access for efficient eviction
	private filteredCache = new Map<string, GalleryNFT[]>();
	private lastFilterKey = '';
	private readonly MAX_CACHE_ENTRIES = PERF_CONFIG.cache.galleryFilter.maxEntries;

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
	 * Build a trait index for efficient O(1) trait lookups during filtering
	 * The index maps NFT ID to a Set of trait identifiers in format "layer:trait"
	 * This avoids recomputing traits for each NFT during every filter operation
	 */
	private buildTraitIndex(nfts: GalleryNFT[]): Map<string, Set<string>> {
		const startTiming = debugTime('Build trait index');
		const index = new Map<string, Set<string>>();

		for (const nft of nfts) {
			// Create a Set of trait identifiers for this NFT
			const traitsSet = new Set<string>();
			for (const trait of nft.metadata.traits) {
				const layer = trait.layer || (trait as any).trait_type;
				const value = trait.trait || (trait as any).value;
				if (layer && value) {
					traitsSet.add(`${layer}:${value}`);
				}
			}
			index.set(nft.id, traitsSet);
		}

		debugCount('Trait index entries', index.size);
		startTiming();
		return index;
	}

	// Track last logged storage usage to reduce log frequency
	private _lastLoggedUsage: number | null = null;

	// Trait index cache for efficient filtering - maps NFT ID to its traits
	private _traitIndex = new Map<string, Set<string>>();
	private _traitIndexCollectionId: string | null = null;

	// Main state
	private _state = $state<GalleryState>({
		collections: [],
		selectedNFT: null,
		selectedCollection: null,
		filterOptions: {},
		sortOption: 'newest',
		isLoading: false,
		error: null
	});

	// Getters
	get collections() {
		return this._state.collections;
	}

	get selectedNFT() {
		return this._state.selectedNFT;
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

	// Fast filtered and sorted NFTs with simple caching
	get filteredAndSortedNFTs(): GalleryNFT[] {
		const endTiming = debugTime('Gallery Filter Process');

		// Get source NFTs
		let sourceNFTs: GalleryNFT[] = [];
		if (this._state.selectedCollection) {
			sourceNFTs = this._state.selectedCollection.nfts;
		} else {
			sourceNFTs = this._state.collections.flatMap((collection) => collection.nfts);
		}
		debugCount('Source NFTs', sourceNFTs.length);

		// Create cache key
		const filterKey = this.createFilterKey(sourceNFTs);

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
		let filtered = [...sourceNFTs];

		// Apply search filter
		if (this._state.filterOptions.search) {
			debugLog('🔍 Applying search filter');
			const searchLower = this._state.filterOptions.search.toLowerCase();
			filtered = filtered.filter(
				(nft) =>
					nft.name.toLowerCase().includes(searchLower) ||
					nft.description?.toLowerCase().includes(searchLower)
			);
			debugCount('After search filter', filtered.length);
		}

		// Apply trait filters using pre-computed index (O(1) lookups instead of O(n*m*k))
		if (this._state.filterOptions.selectedTraits) {
			debugLog('🏷️ Applying trait filters with index');

			// Build trait index if not cached or if collection changed
			const currentCollectionId = this._state.selectedCollection?.id || 'all';
			if (this._traitIndexCollectionId !== currentCollectionId || this._traitIndex.size === 0) {
				this._traitIndex = this.buildTraitIndex(filtered);
				this._traitIndexCollectionId = currentCollectionId;
			}

			// Use the pre-computed index for O(1) lookups
			filtered = filtered.filter((nft) => {
				const nftTraits = this._traitIndex.get(nft.id);
				if (!nftTraits) return false;

				// Check if NFT has all required traits (AND logic)
				for (const [layer, traits] of Object.entries(this._state.filterOptions.selectedTraits!)) {
					const hasLayerTrait = traits.some((trait) => nftTraits.has(`${layer}:${trait}`));
					if (!hasLayerTrait) {
						return false;
					}
				}
				return true;
			});
			debugCount('After trait filters', filtered.length);
		}

		// Apply rarity range filter
		if (this._state.filterOptions.rarityRange) {
			debugLog('⭐ Applying rarity filter');
			const [min, max] = this._state.filterOptions.rarityRange;
			filtered = filtered.filter((nft) => nft.rarityScore >= min && nft.rarityScore <= max);
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
		this.lastFilterKey = filterKey;
		// Update cache memory usage in production monitor
		productionMonitor.updateCacheMemoryUsage('galleryFilter', this.filteredCache.size * 1024);

		debugCount('✅ FINAL RESULT', filtered.length);
		endTiming();
		return filtered;
	}

	/**
	 * Create cache key for current filters
	 */
	private createFilterKey(sourceNFTs: GalleryNFT[]): string {
		const search = this._state.filterOptions.search || '';
		const traits = this._state.filterOptions.selectedTraits
			? JSON.stringify(Object.entries(this._state.filterOptions.selectedTraits).sort())
			: '';
		const rarity = this._state.filterOptions.rarityRange
			? `${this._state.filterOptions.rarityRange[0]}-${this._state.filterOptions.rarityRange[1]}`
			: '';
		const sort = this._state.sortOption;
		const collection = this._state.selectedCollection?.id || 'all';
		const count = sourceNFTs.length;

		return `${collection}:${count}:${search}:${traits}:${rarity}:${sort}`;
	}

	// Actions
	setSelectedNFT(nft: GalleryNFT | null) {
		this._state.selectedNFT = nft;
	}

	setSelectedCollection(collection: GalleryCollection | null) {
		this._state.selectedCollection = collection;
		this._state.selectedNFT = null; // Clear selected NFT when changing collection
		// Clear trait index when switching collections
		this._traitIndex.clear();
		this._traitIndexCollectionId = null;
	}

	setFilterOptions(options: Partial<GalleryFilterOptions>) {
		this._state.filterOptions = { ...this._state.filterOptions, ...options };
		// Clear cache when filters change
		this.filteredCache.clear();
		// Clear trait index when trait filters change (it will be rebuilt on next use)
		if (options.selectedTraits !== undefined) {
			this._traitIndex.clear();
			this._traitIndexCollectionId = null;
		}
	}

	setSortOption(option: GallerySortOption) {
		this._state.sortOption = option;
		// Clear cache when sort changes
		this.filteredCache.clear();
	}

	setLoading(loading: boolean) {
		this._state.isLoading = loading;
	}

	setError(error: string | null) {
		this._state.error = error;
	}

	// Collection management
	addCollection(collection: GalleryCollection) {
		this._state.collections.push(collection);
		this.saveToIndexedDB();
	}

	updateCollection(id: string, updates: Partial<GalleryCollection>) {
		const index = this._state.collections.findIndex((c) => c.id === id);
		if (index !== -1) {
			this._state.collections[index] = { ...this._state.collections[index], ...updates };
			this.saveToIndexedDB();
		}
	}

	async removeCollection(id: string) {
		this._state.collections = this._state.collections.filter((c) => c.id !== id);
		if (this._state.selectedCollection?.id === id) {
			this._state.selectedCollection = null;
			this._state.selectedNFT = null;
		}
		// Delete from IndexedDB
		await deleteCollection(id);
		this.saveToIndexedDB();
	}

	// NFT management
	addNFTToCollection(collectionId: string, nft: GalleryNFT) {
		const collection = this._state.collections.find((c) => c.id === collectionId);
		if (collection) {
			collection.nfts.push(nft);
			collection.totalSupply = collection.nfts.length;
			this.saveToIndexedDB();
		}
	}

	removeNFTFromCollection(collectionId: string, nftId: string) {
		const collection = this._state.collections.find((c) => c.id === collectionId);
		if (collection) {
			collection.nfts = collection.nfts.filter((n) => n.id !== nftId);
			collection.totalSupply = collection.nfts.length;
			if (this._state.selectedNFT?.id === nftId) {
				this._state.selectedNFT = null;
			}
			this.saveToIndexedDB();
		}
	}

	// Database operations
	private async saveToIndexedDB() {
		try {
			// Initialize IndexedDB if not already done
			await initGalleryDB();

			// Save each collection individually to IndexedDB
			// This is more efficient than storing everything in one large object
			for (const collection of this._state.collections) {
				await saveCollection(collection);
			}

			// Save selected collection ID to localStorage (small, safe)
			if (this._state.selectedCollection) {
				localStorage.setItem(
					'nft-studio-gallery-selected-collection',
					this._state.selectedCollection.id
				);
			} else {
				localStorage.removeItem('nft-studio-gallery-selected-collection');
			}

			// Log storage usage for monitoring
			const estimate = await getStorageEstimate();
			if (estimate.quota > 0) {
				const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
				const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
				// Only log storage when usage changes significantly (>1MB)
				const usage = parseFloat(usageMB);
				if (!this._lastLoggedUsage || Math.abs(usage - this._lastLoggedUsage) > 1) {
					// console.log(`Gallery storage: ${usageMB}MB / ${quotaMB}MB used`); // Disabled to reduce console spam
					this._lastLoggedUsage = usage;
				}
			}
		} catch (error) {
			console.error('Failed to save gallery data:', error);
			this.setError('Failed to save gallery data');
		}
	}

	async loadFromIndexedDB() {
		try {
			this.setLoading(true);

			// Load all collections from IndexedDB
			const collections = await getAllCollections();
			this._state.collections = collections;

			// Set cache strategy based on total NFT count
			const totalNFTs = collections.reduce((sum, collection) => sum + collection.nfts.length, 0);
			imageUrlCache.setCollectionSize(totalNFTs);

			// Restore selected collection if it exists (stored in localStorage)
			const selectedCollectionId = localStorage.getItem('nft-studio-gallery-selected-collection');
			if (selectedCollectionId) {
				const selectedCollection = collections.find((c) => c.id === selectedCollectionId);
				if (selectedCollection) {
					this._state.selectedCollection = selectedCollection;
				}
			}

			// Log storage usage for monitoring
			const estimate = await getStorageEstimate();
			if (estimate.quota > 0) {
				const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
				const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
				// Only log storage when usage changes significantly (>1MB)
				const usage = parseFloat(usageMB);
				if (!this._lastLoggedUsage || Math.abs(usage - this._lastLoggedUsage) > 1) {
					// console.log(`Gallery storage: ${usageMB}MB / ${quotaMB}MB used`); // Disabled to reduce console spam
					this._lastLoggedUsage = usage;
				}
			}
		} catch (error) {
			console.error('Failed to load gallery data:', error);
			this.setError('Failed to load gallery data');
		} finally {
			this.setLoading(false);
		}
	}

	// Import generated NFTs from generation system
	importGeneratedNFTs(
		nfts: Array<{ name: string; imageData: ArrayBuffer; metadata: any; index: number }>,
		projectName: string,
		projectDescription: string
	) {
		const collectionId = `collection-${Date.now()}`;

		const collection: GalleryCollection = {
			id: collectionId,
			name: `${projectName} Collection`,
			description: projectDescription,
			projectName,
			nfts: nfts.map((nft, index) => ({
				id: `nft-${collectionId}-${index}`,
				name: nft.name,
				imageData: nft.imageData,
				metadata: nft.metadata,
				rarityScore: 0, // Will be calculated
				rarityRank: 0, // Will be calculated
				collectionId: collectionId,
				generatedAt: new Date()
			})),
			generatedAt: new Date(),
			totalSupply: nfts.length
		};

		// Set cache strategy based on collection size
		imageUrlCache.setCollectionSize(nfts.length);

		// Calculate rarity using proper algorithm
		const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
		this.addCollection(updatedCollection);
		return updatedCollection;
	}

	// Import collection from external data (ZIP file, etc.)
	importCollection(
		nfts: Array<{ name: string; imageData: ArrayBuffer; metadata: any; index: number }>,
		collectionName: string,
		collectionDescription: string = 'Imported NFT collection'
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
			nfts: nfts.map((nft, index) => ({
				id: `nft-${collectionId}-${index}`,
				name: nft.name,
				imageData: nft.imageData,
				metadata: nft.metadata,
				rarityScore: 0, // Will be calculated
				rarityRank: 0, // Will be calculated
				collectionId: collectionId,
				generatedAt: new Date()
			})),
			generatedAt: new Date(),
			totalSupply: nfts.length
		};

		// Set cache strategy based on collection size
		imageUrlCache.setCollectionSize(nfts.length);

		// Calculate rarity using proper algorithm
		const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
		this.addCollection(updatedCollection);
		return updatedCollection;
	}

	// Merge NFTs into existing collection
	mergeIntoCollection(
		collectionId: string,
		nfts: Array<{ name: string; imageData: ArrayBuffer; metadata: any; index: number }>
	) {
		const collection = this._state.collections.find((c) => c.id === collectionId);
		if (!collection) {
			throw new Error('Collection not found');
		}

		const newNFTs = nfts.map((nft, index) => ({
			id: `nft-${collectionId}-${collection.nfts.length + index}`,
			name: nft.name,
			imageData: nft.imageData,
			metadata: nft.metadata,
			rarityScore: Math.random() * 100, // Placeholder - will be calculated properly
			rarityRank: collection.nfts.length + index + 1, // Placeholder - will be calculated properly
			collectionId: collectionId,
			generatedAt: new Date()
		}));

		collection.nfts.push(...newNFTs);
		collection.totalSupply = collection.nfts.length;

		// Update cache strategy based on new collection size
		imageUrlCache.setCollectionSize(collection.nfts.length);

		this.saveToIndexedDB();

		return collection;
	}

	// Validate imported data
	validateImportData(nfts: Array<{ name: string; imageData: ArrayBuffer; metadata?: any }>): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (nfts.length === 0) {
			errors.push('No NFTs found in import data');
		}

		if (nfts.length > 10000) {
			errors.push('Too many NFTs (max 10,000 per collection)');
		}

		// Check for duplicate names
		const names = nfts.map((n) => n.name.toLowerCase());
		const uniqueNames = new Set(names);
		if (names.length !== uniqueNames.size) {
			errors.push('Duplicate NFT names found');
		}

		// Validate each NFT
		nfts.forEach((nft, index) => {
			if (!nft.name || nft.name.trim() === '') {
				errors.push(`NFT ${index + 1} has no name`);
			}

			if (!nft.imageData || nft.imageData.byteLength === 0) {
				errors.push(`NFT ${index + 1} has no image data`);
			}

			// Check for reasonable image size (between 1KB and 10MB)
			if (nft.imageData.byteLength < 1024) {
				errors.push(`NFT ${index + 1} image is too small`);
			}
			if (nft.imageData.byteLength > 10 * 1024 * 1024) {
				errors.push(`NFT ${index + 1} image is too large`);
			}
		});

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	// Utility methods
	async clearGallery() {
		this._state.collections = [];
		this._state.selectedNFT = null;
		this._state.selectedCollection = null;
		// Clear IndexedDB and localStorage
		await clearAllCollections();
		localStorage.removeItem('nft-studio-gallery-selected-collection');
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

// Initialize store on module load
galleryStore.loadFromIndexedDB();
