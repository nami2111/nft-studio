/**
 * Layer-related type definitions for NFT Studio
 * Uses branded types for compile-time safety
 */

import type { LayerId, TraitId } from './ids';

/**
 * Layer interface representing a collection of traits
 */
export interface Layer {
	id: LayerId;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: Trait[];
}

/**
 * Trait type enumeration
 */
export type TraitType = 'normal' | 'ruler';

/**
 * Ruler rule interface for trait compatibility
 */
export interface RulerRule {
	/** Target layer ID this rule applies to */
	layerId: LayerId;
	/** List of trait IDs that are allowed when this ruler is active */
	allowedTraitIds: TraitId[];
	/** List of trait IDs that are forbidden when this ruler is active */
	forbiddenTraitIds: TraitId[];
}

/**
 * Trait interface representing an individual image/attribute
 */
export interface Trait {
	id: TraitId;
	name: string;
	imageData: ArrayBuffer;
	imageUrl?: string;
	rarityWeight: number;
	/** Type of trait - normal or ruler */
	type?: TraitType;
	/** Compatibility rules for ruler traits */
	rulerRules?: RulerRule[];
}

/**
 * Layer creation options interface
 */
export interface LayerCreationOptions {
	name: string;
	order: number;
	isOptional?: boolean;
}

/**
 * Layer update options interface
 */
export interface LayerUpdateOptions {
	name?: string;
	order?: number;
	isOptional?: boolean;
}

/**
 * Layer validation result interface
 */
export interface LayerValidationResult {
	success: boolean;
	error?: string;
	layer?: Layer;
}

/**
 * Layer statistics interface
 */
export interface LayerStats {
	traitCount: number;
	optional: boolean;
	order: number;
	totalRarityWeight: number;
	averageRarityWeight: number;
}

/**
 * Layer reorder operation interface
 */
export interface LayerReorderOperation {
	layerId: LayerId;
	fromIndex: number;
	toIndex: number;
}

/**
 * Layer import options interface
 */
export interface LayerImportOptions {
	preserveOrder: boolean;
	validateImages: boolean;
	skipDuplicates: boolean;
}
