/**
 * Reactive loading state store for Svelte components
 * Provides reactive state for loading operations using Svelte 5 runes
 */

export interface LoadingState {
	progress: number;
	total: number;
	message: string;
	status: 'idle' | 'loading' | 'success' | 'error';
}

// Reactive state using Svelte 5 runes
export const loadingStates = $state<Record<string, boolean>>({});
export const detailedLoadingStates = $state<Record<string, LoadingState>>({});

// Direct mutation functions — components should import these instead of LoadingStateManager
export function startLoading(op: string): void {
	loadingStates[op] = true;
}

export function stopLoading(op: string): void {
	loadingStates[op] = false;
}

export function getLoadingState(op: string): boolean {
	return loadingStates[op] ?? false;
}

export function startDetailedLoading(op: string, total = 100): void {
	detailedLoadingStates[op] = {
		progress: 0,
		total,
		message: 'Starting...',
		status: 'loading'
	};
}

export function updateDetailedLoading(op: string, progress: number, message?: string): void {
	const state = detailedLoadingStates[op];
	if (state) {
		state.progress = progress;
		if (message) state.message = message;
	}
}

export function stopDetailedLoading(op: string, success = true): void {
	const state = detailedLoadingStates[op];
	if (state) {
		state.status = success ? 'success' : 'error';
		state.progress = state.total;
	}
}

export function getDetailedLoadingState(op: string): LoadingState | undefined {
	return detailedLoadingStates[op];
}
