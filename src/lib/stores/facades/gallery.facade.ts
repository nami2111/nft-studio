/**
 * Gallery Store Facade
 * Consistent interface for components to access gallery state and actions.
 */

import type {
	GalleryItem,
	GalleryCollection,
	GalleryFilterOptions,
	GallerySortOption
} from '$lib/types/gallery';
import { galleryStore } from '../gallery.store.svelte';

export interface GalleryStoreFacade {
	state: {
		collections: GalleryCollection[];
		selectedItem: GalleryItem | null;
		selectedCollection: GalleryCollection | null;
		filterOptions: GalleryFilterOptions;
		sortOption: GallerySortOption;
		isLoading: boolean;
		streamProgress: number;
		streamMessage: string;
		error: string | null;
		filteredAndSortedItems: GalleryItem[];
		allTraits: Record<string, string[]>;
	};
	actions: {
		setSelectedItem: (item: GalleryItem | null) => void;
		setSelectedCollection: (collection: GalleryCollection | null) => void;
		setFilterOptions: (options: Partial<GalleryFilterOptions>) => void;
		setSortOption: (option: GallerySortOption) => void;
		setLoading: (loading: boolean) => void;
		setError: (error: string | null) => void;
		setStreamProgress: (progress: number, message: string) => void;
		addCollection: (collection: GalleryCollection) => void;
		updateCollection: (id: string, updates: Partial<GalleryCollection>) => void;
		removeCollection: (id: string) => Promise<void>;
		loadFromStorage: () => Promise<void>;
		createStreamingCollection: (
			metadataItems: Array<{
				name: string;
				traits: Array<{ layer: string; trait: string; rarity: number }>;
				description?: string;
				imageFormat?: string;
			}>,
			collectionName: string,
			collectionDescription?: string
		) => GalleryCollection;
		streamItemImage: (
			collectionId: string,
			itemId: string,
			imageData: ArrayBuffer,
			imageFormat: string
		) => Promise<void>;
		getItemImage: (itemId: string) => Promise<ArrayBuffer | null>;
		importCollection: (
			items: Array<{
				name: string;
				imageData: ArrayBuffer | string;
				metadata: Record<string, unknown>;
				index: number;
				isBlobUrl?: boolean;
				imageFormat?: string;
			}>,
			collectionName: string,
			collectionDescription?: string
		) => GalleryCollection;
		clearGallery: () => Promise<void>;
		exportCollection: (collectionId: string) => GalleryCollection | null;
	};
}

export function createGalleryFacade(): GalleryStoreFacade {
	return {
		state: {
			get collections() {
				return galleryStore.collections;
			},
			get selectedItem() {
				return galleryStore.selectedItem;
			},
			get selectedCollection() {
				return galleryStore.selectedCollection;
			},
			get filterOptions() {
				return galleryStore.filterOptions;
			},
			get sortOption() {
				return galleryStore.sortOption;
			},
			get isLoading() {
				return galleryStore.isLoading;
			},
			get streamProgress() {
				return galleryStore.streamProgress;
			},
			get streamMessage() {
				return galleryStore.streamMessage;
			},
			get error() {
				return galleryStore.error;
			},
			get filteredAndSortedItems() {
				return galleryStore.filteredAndSortedItems;
			},
			get allTraits() {
				return galleryStore.allTraits;
			}
		},
		actions: {
			setSelectedItem: (item) => galleryStore.setSelectedItem(item),
			setSelectedCollection: (collection) => galleryStore.setSelectedCollection(collection),
			setFilterOptions: (options) => galleryStore.setFilterOptions(options),
			setSortOption: (option) => galleryStore.setSortOption(option),
			setLoading: (loading) => galleryStore.setLoading(loading),
			setError: (error) => galleryStore.setError(error),
			setStreamProgress: (progress, message) => galleryStore.setStreamProgress(progress, message),
			addCollection: (collection) => galleryStore.addCollection(collection),
			updateCollection: (id, updates) => galleryStore.updateCollection(id, updates),
			removeCollection: (id) => galleryStore.removeCollection(id),
			loadFromStorage: () => galleryStore.loadFromStorage(),
			createStreamingCollection: (metadataItems, collectionName, collectionDescription) =>
				galleryStore.createStreamingCollection(
					metadataItems,
					collectionName,
					collectionDescription
				),
			streamItemImage: (collectionId, itemId, imageData, imageFormat) =>
				galleryStore.streamItemImage(collectionId, itemId, imageData, imageFormat),
			getItemImage: (itemId) => galleryStore.getItemImage(itemId),
			importCollection: (items, collectionName, collectionDescription) =>
				galleryStore.importCollection(items, collectionName, collectionDescription),
			clearGallery: () => galleryStore.clearGallery(),
			exportCollection: (collectionId) => galleryStore.exportCollection(collectionId)
		}
	};
}
