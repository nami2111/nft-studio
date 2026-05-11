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

// Base message interface with common properties
interface BaseWorkerMessage {
	type: string;
	taskId?: TaskId;
}

// Progress update message
export interface ProgressMessage extends BaseWorkerMessage {
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
export interface CompleteMessage extends BaseWorkerMessage {
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
export interface ErrorMessage extends BaseWorkerMessage {
	type: 'error';
	payload: {
		message: string;
		code?: string; // Specific error code for better handling
		recoverable?: boolean; // Whether the error is recoverable
	};
}

// Worker ready message
export interface ReadyMessage extends BaseWorkerMessage {
	type: 'ready';
}

// Generation cancelled message
export interface CancelledMessage extends BaseWorkerMessage {
	type: 'cancelled';
	payload: {
		generatedCount?: number;
		totalCount?: number;
		reason?: string; // Reason for cancellation
	};
}

// Preview generation message
export interface PreviewMessage extends BaseWorkerMessage {
	type: 'preview';
	payload: {
		indexes: number[];
		previewData: ArrayBuffer[];
		metadata?: { name: string; data: object }[];
	};
}

// Batch generation message for parallel processing
export interface BatchMessage extends BaseWorkerMessage {
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
export interface InitLayersMessage extends BaseWorkerMessage {
	type: 'init-layers';
	payload: {
		layers: TransferrableLayer[];
	};
}

// Batch generation by trait references (lightweight, no imageData duplication)
export interface BatchRefMessage extends BaseWorkerMessage {
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
export interface GenerationChunkMessage extends BaseWorkerMessage {
	type: 'chunk';
	payload: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: object }[];
		generatedCount: number;
		totalCount: number;
	};
}

// Messages that can be sent from workers to the main thread
export type OutgoingWorkerMessage =
	| ReadyMessage
	| ProgressMessage
	| CompleteMessage
	| ErrorMessage
	| CancelledMessage
	| PreviewMessage
	| GenerationChunkMessage
	| { type: 'pingResponse'; pingResponse: string };

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

// Type guards for discriminated unions

/**
 * Type guard for ProgressMessage
 */
export function isProgressMessage(message: unknown): message is ProgressMessage {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'progress'
	);
}

/**
 * Type guard for CompleteMessage
 */
export function isCompleteMessage(message: unknown): message is CompleteMessage {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'complete'
	);
}

/**
 * Type guard for ErrorMessage
 */
export function isErrorMessage(message: unknown): message is ErrorMessage {
	return (
		typeof message === 'object' && message !== null && 'type' in message && message.type === 'error'
	);
}

/**
 * Type guard for CancelledMessage
 */
export function isCancelledMessage(message: unknown): message is CancelledMessage {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'cancelled'
	);
}

/**
 * Type guard for PreviewMessage
 */
export function isPreviewMessage(message: unknown): message is PreviewMessage {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'preview'
	);
}

/**
 * Type guard for OutgoingWorkerMessage
 */
export function isOutgoingWorkerMessage(message: unknown): message is OutgoingWorkerMessage {
	return (
		(typeof message === 'object' &&
			message !== null &&
			'type' in message &&
			message.type === 'ready') ||
		isProgressMessage(message) ||
		isCompleteMessage(message) ||
		isErrorMessage(message) ||
		isPreviewMessage(message)
	);
}

/**
 * Type guard for IncomingMessage
 */
export function isIncomingMessage(message: unknown): message is IncomingMessage {
	return (
		(typeof message === 'object' &&
			message !== null &&
			'type' in message &&
			message.type === 'batch') ||
		(typeof message === 'object' &&
			message !== null &&
			'type' in message &&
			message.type === 'cancel') ||
		(typeof message === 'object' &&
			message !== null &&
			'type' in message &&
			message.type === 'ready')
	);
}
