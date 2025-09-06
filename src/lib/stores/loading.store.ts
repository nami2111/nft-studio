// Legacy loading store for backward compatibility
// New implementation uses runes in stores.svelte
import { writable } from 'svelte/store';

interface LoadingState {
	[key: string]: boolean;
}

function createLoadingStore() {
	const { subscribe, set, update } = writable<LoadingState>({});

	return {
		subscribe,
		start: (key: string) => update((state) => ({ ...state, [key]: true })),
		stop: (key: string) => update((state) => ({ ...state, [key]: false })),
		reset: () => set({}),
		isLoading: (key: string) => {
			let loading = false;
			const unsubscribe = subscribe((state) => {
				loading = state[key] || false;
			});
			unsubscribe();
			return loading;
		},
		getAll: () => {
			let allStates: LoadingState = {};
			const unsubscribe = subscribe((state) => {
				allStates = { ...state };
			});
			unsubscribe();
			return allStates;
		}
	};
}

export const loadingStore = createLoadingStore();
