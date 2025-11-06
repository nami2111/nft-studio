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

/**
 * Generated NFT interface
 */
export interface GeneratedNFT {
	name: string;
	imageData: ArrayBuffer;
	metadata: object;
	index: number;
}

/**
 * Generation progress interface
 */
export interface GenerationProgress {
	generatedCount: number;
	totalCount: number;
	statusText: string;
	memoryUsage?: {
		used: number;
		available: number;
		units: string;
	};
}

/**
 * Project export options interface
 */
export interface ExportOptions {
	format: 'zip' | 'json' | 'png';
	includeMetadata: boolean;
	includeImages: boolean;
	quality?: number;
}

/**
 * Project import options interface
 */
export interface ImportOptions {
	format: 'zip' | 'json';
	validateStructure: boolean;
	preserveOrder: boolean;
}
