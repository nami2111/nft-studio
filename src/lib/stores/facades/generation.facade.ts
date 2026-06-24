/**
 * Generation Store Facade
 * Consistent interface for components to access generation state and actions.
 */

import {
	generationState,
	startGeneration,
	pauseGeneration,
	completeGeneration,
	updateProgress,
	addPreviews,
	handleError,
	resetState,
	cleanupGenerationState,
	type GenerationState,
	type StartGenerationConfig,
	type GenerationProgressUpdate
} from '../generation-progress.svelte';
import type { ErrorMessage } from '$lib/types/worker-messages';

export interface GenerationStoreFacade {
	state: GenerationState;
	actions: {
		startGeneration: (config: StartGenerationConfig) => string;
		pauseGeneration: (reason?: string) => void;
		completeGeneration: () => void;
		updateProgress: (data: GenerationProgressUpdate) => void;
		addPreviews: (previews: { index: number; url: string }[]) => void;
		handleError: (msg: ErrorMessage) => void;
		resetState: () => void;
		cleanupGenerationState: () => void;
	};
}

export function createGenerationFacade(): GenerationStoreFacade {
	return {
		state: generationState,
		actions: {
			startGeneration,
			pauseGeneration,
			completeGeneration,
			updateProgress,
			addPreviews,
			handleError,
			resetState,
			cleanupGenerationState
		}
	};
}
