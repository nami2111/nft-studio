/**
 * Central domain models for NFT Studio
 * Provides type definitions and domain model abstractions
 */

import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';

// Central domain models mapped to existing types
export type DomainProject = Project;
export type DomainLayer = Layer;
export type DomainTrait = Layer['traits'][number];

// For clarity, export simple shaped interfaces potentially extended later
export interface IDomainProjectLike {
	id: string;
	name: string;
	description: string;
	layers: IDomainLayerLike[];
}

export interface IDomainLayerLike {
	id: string;
	name: string;
	order: number;
	traits: IDomainTraitLike[];
}

export interface IDomainTraitLike {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
}

// Domain-specific validation interfaces
export interface DomainValidationResult {
	success: boolean;
	error?: string;
	data?: unknown;
}

export interface DomainOperationResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: Date;
}

// Domain event types
export interface DomainEvent {
	type: string;
	payload: unknown;
	timestamp: Date;
}

export interface ProjectCreatedEvent extends DomainEvent {
	type: 'project.created';
	payload: {
		projectId: string;
		projectName: string;
	};
}

export interface LayerAddedEvent extends DomainEvent {
	type: 'layer.added';
	payload: {
		projectId: string;
		layerId: string;
		layerName: string;
	};
}

export interface TraitAddedEvent extends DomainEvent {
	type: 'trait.added';
	payload: {
		projectId: string;
		layerId: string;
		traitId: string;
		traitName: string;
	};
}

export interface GenerationStartedEvent extends DomainEvent {
	type: 'generation.started';
	payload: {
		projectId: string;
		collectionSize: number;
	};
}

export interface GenerationCompletedEvent extends DomainEvent {
	type: 'generation.completed';
	payload: {
		projectId: string;
		generatedCount: number;
		totalCount: number;
	};
}

// Domain service interfaces
export interface IDomainService {
	validateProject(project: DomainProject): DomainValidationResult;
	validateLayer(layer: DomainLayer): DomainValidationResult;
	validateTrait(trait: DomainTrait): DomainValidationResult;
}

// Domain repository interfaces
export interface IDomainRepository<T> {
	save(entity: T): Promise<DomainOperationResult>;
	findById(id: string): Promise<DomainOperationResult<T>>;
	findAll(): Promise<DomainOperationResult<T[]>>;
	delete(id: string): Promise<DomainOperationResult>;
}
