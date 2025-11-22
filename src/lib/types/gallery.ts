/**
 * Gallery-related type definitions for NFT Studio
 * Extends existing project types with gallery-specific functionality
 */

import type { ProjectId } from './ids';

/**
 * Gallery NFT interface representing a generated NFT in the gallery
 */
export interface GalleryNFT {
	id: string;
	name: string;
	description?: string;
	imageData: ArrayBuffer;
	imageUrl?: string;
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
}

/**
 * Gallery collection interface for organizing NFTs
 */
export interface GalleryCollection {
	id: string;
	name: string;
	description: string;
	projectName: string;
	nfts: GalleryNFT[];
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
	selectedNFT: GalleryNFT | null;
	selectedCollection: GalleryCollection | null;
	filterOptions: GalleryFilterOptions;
	sortOption: GallerySortOption;
	isLoading: boolean;
	error: string | null;
}

/**
 * Gallery statistics interface
 */
export interface GalleryStats {
	totalNFTs: number;
	totalCollections: number;
	rarestNFTs: GalleryNFT[];
	mostCommonTraits: Array<{
		layer: string;
		trait: string;
		count: number;
		percentage: number;
	}>;
}
