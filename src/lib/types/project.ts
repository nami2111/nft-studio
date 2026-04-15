/**
 * Project-related type definitions for NFT Studio
 * Uses branded types for compile-time safety
 */

import type { ProjectId } from './ids';
import type { Layer, Trait } from './layer';

/**
 * Project dimensions interface
 */
export interface ProjectDimensions {
	width: number;
	height: number;
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

export type { Layer, Trait };
export type { StrictPairConfig, LayerCombination } from './layer';
