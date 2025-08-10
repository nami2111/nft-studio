import { writable } from 'svelte/store';

interface LoadingState {
	[key: string]: boolean;
}

const initialState: LoadingState = {};

function createLoadingStore() {
	const { subscribe, set, update } = writable<LoadingState>(initialState);

	return {
		subscribe,
		start: (key: string) => update((state) => ({ ...state, [key]: true })),
		stop: (key: string) => update((state) => ({ ...state, [key]: false })),
		reset: () => set(initialState),
		isLoading: (key: string) => {
			let loading = false;
			const unsubscribe = subscribe((state) => {
				loading = state[key] || false;
			});
			unsubscribe();
			return loading;
		},
		// Get all loading states
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
