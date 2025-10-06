/**
 * Reactive loading state store for Svelte components
 * Provides reactive state for loading operations using Svelte 5 runes
 */

import { loadingStateManager } from './loading-state';
import type { LoadingState } from './loading-state';

// Reactive state using Svelte 5 runes
export const loadingStates = $state<Record<string, boolean>>({});
export const detailedLoadingStates = $state<Record<string, LoadingState>>({});

// Subscribe to loading state manager updates
loadingStateManager.subscribe(() => {
	// Update reactive state when manager state changes
	Object.assign(loadingStates, loadingStateManager.getAllLoadingStates());
	Object.assign(detailedLoadingStates, loadingStateManager.getAllDetailedStates());
});

// Initialize with current state
Object.assign(loadingStates, loadingStateManager.getAllLoadingStates());
Object.assign(detailedLoadingStates, loadingStateManager.getAllDetailedStates());
