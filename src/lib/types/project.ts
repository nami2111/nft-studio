/**
 * Project-related type definitions for NFT Studio
 * Uses branded types for compile-time safety
 */

import type { ProjectId, LayerId, TraitId } from './ids';

/**
 * Project dimensions interface
 */
export interface ProjectDimensions {
	width: number;
	height: number;
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
	type?: import('./layer').TraitType;
	/** Compatibility rules for ruler traits */
	rulerRules?: import('./layer').RulerRule[];
}

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
 * Project interface representing the complete NFT collection configuration
 */
export interface Project {
	id: ProjectId;
	name: string;
	description: string;
	outputSize: ProjectDimensions;
	metadataStandard?: import('$lib/domain/metadata/metadata.strategy').MetadataStandard;
	symbol?: string;
	sellerFeeBasisPoints?: number;
	externalUrl?: string;
	animationUrl?: string;
	creators?: { address: string; share: number }[];
	layers: Layer[];
	/** Strict Pair configuration for trait combination uniqueness */
	strictPairConfig?: import('./layer').StrictPairConfig;
	_needsProperLoad?: boolean;
}

/**
 * Generation settings interface
 */
export interface GenerationSettings {
	collectionSize: number;
	outputSize: ProjectDimensions;
	projectName: string;
	projectDescription: string;
}

