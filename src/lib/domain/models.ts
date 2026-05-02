/**
 * Domain event types for the application
 */

// Domain event types
export interface DomainEvent {
	type: string;
	payload: unknown;
	timestamp: Date;
}

export interface ProjectCreatedEvent extends DomainEvent {
	type: "project.created";
	payload: {
		projectId: string;
		projectName: string;
	};
}

export interface LayerAddedEvent extends DomainEvent {
	type: "layer.added";
	payload: {
		projectId: string;
		layerId: string;
		layerName: string;
	};
}

export interface TraitAddedEvent extends DomainEvent {
	type: "trait.added";
	payload: {
		projectId: string;
		layerId: string;
		traitId: string;
		traitName: string;
	};
}

export interface GenerationStartedEvent extends DomainEvent {
	type: "generation.started";
	payload: {
		projectId: string;
		collectionSize: number;
	};
}

export interface GenerationCompletedEvent extends DomainEvent {
	type: "generation.completed";
	payload: {
		projectId: string;
		generatedCount: number;
		totalCount: number;
	};
}

// Domain operation interfaces
export interface DomainOperationResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: Date;
}

// Domain repository interface
export interface IDomainRepository<T> {
	save(entity: T): Promise<DomainOperationResult>;
	findById(id: string): Promise<DomainOperationResult<T>>;
	findAll(): Promise<DomainOperationResult<T[]>>;
	delete(id: string): Promise<DomainOperationResult>;
}
