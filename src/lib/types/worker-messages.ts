// src/lib/types/worker-messages.ts

import type { LayerId, TraitId, TaskId } from './ids';
import type { TraitType, RulerRule } from './layer';

// Worker message interfaces for generation worker
export interface TransferrableTrait {
	id: TraitId;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
	// Add width/height for better memory management
	width?: number;
	height?: number;
	// Ruler trait properties
	type?: TraitType;
	rulerRules?: RulerRule[];
}

export interface TransferrableLayer {
	id: LayerId;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: TransferrableTrait[];
	// Add layer-level width/height for consistent sizing
	width?: number;
	height?: number;
}

// Base message interface for messages FROM workers (outgoing)
// These require taskId for O(1) task resolution in the pool
interface BaseOutgoingMessage {
	type: string;
	taskId: TaskId; // Required for O(1) task resolution
}

// Base message interface for messages TO workers (incoming)
// These don't need taskId - workers track their own state
interface BaseIncomingMessage {
	type: string;
	taskId?: TaskId; // Optional, assigned by pool when dispatching
}

// Progress update message
export interface ProgressMessage extends BaseOutgoingMessage {
	type: 'progress';
	payload: {
		generatedCount: number;
		totalCount: number;
		statusText: string;
		memoryUsage?:
			| number
			| {
					used: number;
					available: number;
					units: string;
			  };
	};
}

// Generation complete message
export interface CompleteMessage extends BaseOutgoingMessage {
	type: 'complete';
	payload: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: object }[];
		isChunk?: boolean; // Flag to indicate if this is a chunked response
		generatedCount?: number;
		totalCount?: number;
	};
}

// Error message
export interface ErrorMessage extends BaseOutgoingMessage {
	type: 'error';
	payload: {
		message: string;
		code?: string; // Specific error code for better handling
		recoverable?: boolean; // Whether the error is recoverable
	};
}

// Worker ready message
export interface ReadyMessage {
	type: 'ready';
	taskId?: never; // Control message, no task association
}

// Generation cancelled message
export interface CancelledMessage extends BaseOutgoingMessage {
	type: 'cancelled';
	payload: {
		generatedCount?: number;
		totalCount?: number;
		reason?: string; // Reason for cancellation
	};
}

// Preview generation message
export interface PreviewMessage extends BaseOutgoingMessage {
	type: 'preview';
	payload: {
		indexes: number[];
		previewData: ArrayBuffer[];
		metadata?: { name: string; data: object }[];
	};
}

// Batch generation message for parallel processing
export interface BatchMessage extends BaseIncomingMessage {
	type: 'batch';
	payload: {
		solutions: { index: number; traits: { layerId: string; trait: TransferrableTrait }[] }[];
		layers: TransferrableLayer[];
		collectionSize: number;
		outputSize: { width: number; height: number };
		projectName: string;
		projectDescription: string;
		metadataStandard?: import('$lib/domain/metadata/metadata.strategy').MetadataStandard;
		extraData?: Record<string, unknown>;
	};
}

// Initialize layers once in the worker (used with enableLayerRef)
export interface InitLayersMessage extends BaseIncomingMessage {
	type: 'init-layers';
	payload: {
		layers: TransferrableLayer[];
	};
}

// Batch generation by trait references (lightweight, no imageData duplication)
export interface BatchRefMessage extends BaseIncomingMessage {
	type: 'batch-ref';
	payload: {
		solutions: {
			index: number;
			traitRefs: { layerId: string; traitId: string }[];
		}[];
		collectionSize: number;
		outputSize: { width: number; height: number };
		projectName: string;
		projectDescription: string;
		metadataStandard?: import('$lib/domain/metadata/metadata.strategy').MetadataStandard;
		extraData?: Record<string, unknown>;
	};
}

// Intermediate chunk of generation results streamed from worker before final completion.
// This allows incremental flushing within a single batch task — images are transferred
// via Transferables and the task stays active until a 'complete' message arrives.
export interface GenerationChunkMessage extends BaseOutgoingMessage {
	type: 'chunk';
	payload: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: object }[];
		generatedCount: number;
		totalCount: number;
	};
}

// Messages that can be sent from workers to the main thread
// Discriminated union: task-related messages require taskId, control messages don't
export type OutgoingWorkerMessage =
	| ReadyMessage
	| ProgressMessage
	| CompleteMessage
	| ErrorMessage
	| CancelledMessage
	| PreviewMessage
	| GenerationChunkMessage
	| { type: 'pingResponse'; pingResponse: string; taskId?: never };

// Messages that can be sent to workers
export type IncomingMessage =
	| BatchMessage
	| InitLayersMessage
	| BatchRefMessage
	| { type: 'cancel' }
	| ReadyMessage
	| { type: 'preview'; payload: Record<string, unknown> }
	| { type: 'initialize' }
	| { type: 'ping'; pingId: string };

// Worker pool message types
export type GenerationWorkerMessage =
	| BatchMessage
	| InitLayersMessage
	| BatchRefMessage
	| {
			type: 'cancel';
	  };
