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

/**
 * Strict Pair configuration interface
 */
export interface StrictPairConfig {
	/** Whether Strict Pair mode is enabled */
	enabled: boolean;
	/** List of layer combinations that should have unique trait combinations */
	layerCombinations: LayerCombination[];
}

/**
 * Layer combination definition for Strict Pair tracking
 */
export interface LayerCombination {
	/** Unique identifier for this layer combination */
	id: string;
	/** Array of layer IDs in this combination */
	layerIds: LayerId[];
	/** Description of the layer combination (e.g., "BASE + HEAD + ACCESSORY") */
	description: string;
	/** Whether this layer combination is currently active */
	active: boolean;
}

/**
 * Individual trait combination that was generated
 */
export interface GeneratedTraitCombination {
	/** Array of trait IDs (one for each layer in the combination) */
	traitIds: TraitId[];
	/** Whether this combination has been used */
	used: boolean;
}

/**
 * Strict Pair violation result interface
 */
export interface StrictPairViolation {
	/** The generated trait combination that violates Strict Pair rules */
	combination: Array<{
		layerId: LayerId;
		traitId: TraitId;
		traitName: string;
		layerName: string;
	}>;
	/** The conflicting combination ID */
	violatedCombinationId: string;
	/** Description of the violation */
	description: string;
}
