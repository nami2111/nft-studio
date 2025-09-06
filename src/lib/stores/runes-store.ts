import { writable, get } from 'svelte/store';
import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';
import { LocalStorageStore } from '$lib/persistence/storage';
import { fileToArrayBuffer } from '$lib/utils';
import {
	isValidDimensions,
	isValidProjectName,
	isValidLayerName,
	isValidTraitName
} from '$lib/utils/validation';
import { handleValidationError } from '$lib/utils/error-handler';

// Local storage key
const PROJECT_STORAGE_KEY = 'nft-studio-project';
const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY);

// Default project
function defaultProject(): Project {
	return {
		id: crypto.randomUUID(),
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: {
			width: 0,
			height: 0
		},
		layers: []
	};
}

// Create reactive stores using Svelte 5 compatible patterns
export const projectStore = writable<Project>(defaultProject());
export const loadingStore = writable<Record<string, boolean>>({});

// Initialize from storage
LOCAL_STORE.load().then((stored) => {
	if (stored) {
		projectStore.set(restoreBlobUrls(stored));
	}
});

// Auto-save to storage
projectStore.subscribe((project) => {
	LOCAL_STORE.save(project);
});

// Helper functions
function restoreBlobUrls(p: Project): Project {
	const restoredProject = { ...p };

	for (const layer of restoredProject.layers) {
		for (const trait of layer.traits) {
			if (trait.imageData && trait.imageData.byteLength > 0) {
				if (trait.imageUrl) {
					try {
						URL.revokeObjectURL(trait.imageUrl);
					} catch {
						// Ignore cleanup errors
					}
				}
				const blob = new Blob([trait.imageData], { type: 'image/png' });
				trait.imageUrl = URL.createObjectURL(blob);
			}
		}
	}

	return restoredProject;
}

function sortLayers(layers: Layer[]): Layer[] {
	return layers.sort((a, b) => a.order - b.order);
}

// Project functions
export function updateProjectName(name: string): void {
	if (!isValidProjectName(name)) {
		handleValidationError<void>(
			new Error('Invalid project name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateProjectName' }
			}
		);
		return;
	}
	projectStore.update((p) => ({ ...p, name }));
}

export function updateProjectDescription(description: string): void {
	projectStore.update((p) => ({ ...p, description }));
}

export function updateProjectDimensions(width: number, height: number): void {
	if (!isValidDimensions(width, height)) {
		handleValidationError<void>(
			new Error('Invalid dimensions: width and height must be positive numbers'),
			{
				context: { component: 'ProjectStore', action: 'updateProjectDimensions' }
			}
		);
		return;
	}
	projectStore.update((p) => ({ ...p, outputSize: { width, height } }));
}

export function addLayer(layer: Omit<Layer, 'id' | 'traits'>): void {
	if (!isValidLayerName(layer.name)) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'addLayer' }
			}
		);
		return;
	}

	projectStore.update((p) => ({
		...p,
		layers: sortLayers([...p.layers, { ...layer, id: crypto.randomUUID(), traits: [] }])
	}));
}

export function removeLayer(layerId: string): void {
	projectStore.update((p) => ({
		...p,
		layers: p.layers.filter((layer) => layer.id !== layerId)
	}));
}

export function updateLayerName(layerId: string, name: string): void {
	if (!isValidLayerName(name)) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateLayerName' }
			}
		);
		return;
	}
	projectStore.update((p) => ({
		...p,
		layers: p.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer))
	}));
}

export function reorderLayers(reorderedLayers: Layer[]): void {
	projectStore.update((p) => ({
		...p,
		layers: sortLayers(reorderedLayers)
	}));
}

export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<void> {
	if (!isValidTraitName(trait.name)) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'addTrait' }
			}
		);
		return;
	}

	const arrayBuffer = await fileToArrayBuffer(trait.imageData);
	const imageUrl = URL.createObjectURL(trait.imageData);

	const newTrait: Trait = {
		...trait,
		id: crypto.randomUUID(),
		imageUrl,
		imageData: arrayBuffer
	};

	projectStore.update((p) => {
		// Auto-set project output size based on first uploaded image
		let newOutputSize = p.outputSize;
		const isFirstImage = p.layers.every((layer) => layer.traits.length === 0);

		if (isFirstImage && trait.width && trait.height) {
			newOutputSize = { width: trait.width, height: trait.height };
		}

		const newLayers = p.layers.map((layer) => {
			if (layer.id === layerId) {
				return { ...layer, traits: [...layer.traits, newTrait] };
			}
			return layer;
		});
		return { ...p, outputSize: newOutputSize, layers: newLayers };
	});
}

export function removeTrait(layerId: string, traitId: string): void {
	// Revoke object URL for the trait being removed to avoid memory leaks
	try {
		const current = get(projectStore);
		const layer = current.layers.find((l) => l.id === layerId);
		const trait = layer?.traits.find((t) => t.id === traitId);
		if (trait?.imageUrl) {
			URL.revokeObjectURL(trait.imageUrl);
		}
	} catch {
		// noop in non-browser contexts
	}

	projectStore.update((p) => {
		return {
			...p,
			layers: p.layers.map((layer) => {
				if (layer.id !== layerId) return layer;
				const nextTraits = layer.traits.filter((trait) => trait.id !== traitId);
				return { ...layer, traits: nextTraits };
			})
		};
	});
}

export function updateTraitName(layerId: string, traitId: string, name: string): void {
	if (!isValidTraitName(name)) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateTraitName' }
			}
		);
		return;
	}
	projectStore.update((p) => ({
		...p,
		layers: p.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.map((trait) => (trait.id === traitId ? { ...trait, name } : trait))
					}
				: layer
		)
	}));
}

export function updateTraitRarity(layerId: string, traitId: string, rarityWeight: number): void {
	projectStore.update((p) => ({
		...p,
		layers: p.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.map((trait) =>
							trait.id === traitId ? { ...trait, rarityWeight } : trait
						)
					}
				: layer
		)
	}));
}

// Loading state functions
export function startLoading(key: string): void {
	loadingStore.update((state) => ({ ...state, [key]: true }));
}

export function stopLoading(key: string): void {
	loadingStore.update((state) => ({ ...state, [key]: false }));
}

export function resetLoading(): void {
	loadingStore.set({});
}

export function isLoading(key: string): boolean {
	let loading = false;
	const unsubscribe = loadingStore.subscribe((state) => {
		loading = state[key] || false;
	});
	unsubscribe();
	return loading;
}

// Export stores for direct access
export { projectStore as project, loadingStore as loadingStates };
