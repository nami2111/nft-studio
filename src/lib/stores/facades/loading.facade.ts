/**
 * Loading State Facade
 * Consistent interface for components to access loading state and actions.
 */

import type { LoadingState } from '../loading-state.svelte';
import {
	loadingStates,
	detailedLoadingStates,
	startLoading,
	stopLoading,
	getLoadingState,
	startDetailedLoading,
	updateDetailedLoading,
	stopDetailedLoading,
	getDetailedLoadingState
} from '../loading-state.svelte';

export interface LoadingStateFacade {
	state: {
		loadingStates: Record<string, boolean>;
		detailedLoadingStates: Record<string, LoadingState>;
	};
	actions: {
		startLoading: (op: string) => void;
		stopLoading: (op: string) => void;
		getLoadingState: (op: string) => boolean;
		startDetailedLoading: (op: string, total?: number) => void;
		updateDetailedLoading: (op: string, progress: number, message?: string) => void;
		stopDetailedLoading: (op: string, success?: boolean) => void;
		getDetailedLoadingState: (op: string) => LoadingState | undefined;
	};
}

export function createLoadingFacade(): LoadingStateFacade {
	return {
		state: {
			get loadingStates() {
				return loadingStates;
			},
			get detailedLoadingStates() {
				return detailedLoadingStates;
			}
		},
		actions: {
			startLoading,
			stopLoading,
			getLoadingState,
			startDetailedLoading,
			updateDetailedLoading,
			stopDetailedLoading,
			getDetailedLoadingState
		}
	};
}
