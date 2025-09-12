// src/lib/types/worker-messages.ts

// Worker message interfaces for generation worker
export interface TransferrableTrait {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
	// Add width/height for better memory management
	width?: number;
	height?: number;
}

export interface TransferrableLayer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: TransferrableTrait[];
	// Add layer-level width/height for consistent sizing
	width?: number;
	height?: number;
}

export interface StartMessage {
	type: 'start';
	payload: {
		layers: TransferrableLayer[];
		collectionSize: number;
		outputSize: {
			width: number;
			height: number;
		};
		projectName: string;
		projectDescription: string;
	};
}

export interface ProgressMessage {
	type: 'progress';
	payload: {
		generatedCount: number;
		totalCount: number;
		statusText: string;
		memoryUsage?: {
			used: number;
			available: number;
			units: string;
		};
	};
}

export interface CompleteMessage {
	type: 'complete';
	payload: {
		images: { name: string; imageData: ArrayBuffer }[];
		metadata: { name: string; data: object }[];
		isChunk?: boolean; // Flag to indicate if this is a chunked response
	};
}

export interface ErrorMessage {
	type: 'error';
	payload: {
		message: string;
	};
}

export interface ReadyMessage {
	type: 'ready';
}

export interface CancelledMessage {
	type: 'cancelled';
	payload: {
		generatedCount?: number;
		totalCount?: number;
	};
}

// Messages that can be sent from workers to the main thread
export type OutgoingWorkerMessage =
	| ReadyMessage
	| ProgressMessage
	| CompleteMessage
	| ErrorMessage
	| CancelledMessage;

export type IncomingMessage = StartMessage | { type: 'cancel' } | ReadyMessage;

// Worker pool message types
export type GenerationWorkerMessage =
	| {
			type: 'start';
			payload: {
				layers: TransferrableLayer[];
				collectionSize: number;
				outputSize: { width: number; height: number };
				projectName: string;
				projectDescription: string;
			};
	  }
	| {
			type: 'cancel';
	  };
