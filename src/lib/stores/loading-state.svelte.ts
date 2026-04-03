/**
 * Reactive loading state store for Svelte components
 * Provides reactive state for loading operations using Svelte 5 runes
 *
 * @note This uses a hybrid bridge pattern: LoadingStateManager (legacy pub/sub) is bridged
 * to Svelte 5 $state via Object.assign. This is intentional — LoadingStateManager handles
 * async operations outside of Svelte's reactivity system, and the $state objects serve as
 * the reactive read interface for components.
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
