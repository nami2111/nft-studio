/**
 * Gallery-related type definitions
 * Extends existing project types with gallery-specific functionality
 */

/**
 * Gallery item interface representing a generated item in the gallery
 */
export interface GalleryItem {
	id: string;
	name: string;
	description?: string;
	imageData: ArrayBuffer | string; // ArrayBuffer for standard processing, string (blob URL) for streaming
	imageUrl?: string;
	imageFormat?: string; // Original image format (png, jpg, jpeg, webp, gif, etc.)
	metadata: {
		traits: Array<{
			layer: string;
			trait: string;
			rarity: number;
		}>;
	};
	rarityScore: number;
	rarityRank: number;
	collectionId: string;
	generatedAt: Date;
	isBlobUrl?: boolean; // Optional flag to indicate if imageData is a blob URL
}

/**
 * Gallery collection interface for organizing items
 */
export interface GalleryCollection {
	id: string;
	name: string;
	description: string;
	projectName: string;
	items: GalleryItem[];
	generatedAt: Date;
	totalSupply: number;
}

/**
 * Gallery filter options interface
 */
export interface GalleryFilterOptions {
	search?: string;
	selectedTraits?: Record<string, string[]>;
	rarityRange?: [number, number];
	collectionId?: string;
}

/**
 * Gallery sort options interface
 */
export type GallerySortOption =
	| 'name-asc'
	| 'name-desc'
	| 'rarity-asc'
	| 'rarity-desc'
	| 'newest'
	| 'oldest';

/**
 * Gallery state interface for store management
 */
export interface GalleryState {
	collections: GalleryCollection[];
	selectedItem: GalleryItem | null;
	selectedCollection: GalleryCollection | null;
	filterOptions: GalleryFilterOptions;
	sortOption: GallerySortOption;
	isLoading: boolean;
	streamProgress: number;
	streamMessage: string;
	error: string | null;
}
