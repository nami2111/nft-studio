import { get } from 'svelte/store';
import { project } from '../project/project.store';
import type { Layer } from '$lib/types/layer';
import { sortLayers } from '$lib/stores/store-core';
import { isValidLayerName } from '$lib/utils/validation';
import { handleValidationError } from '$lib/utils/error-handler';

// --- Layer Level Functions ---
export function addLayer(layer: Omit<Layer, 'id' | 'traits'>): void {
	if (!isValidLayerName(layer.name)) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'LayersStore', action: 'addLayer' }
			}
		);
		return;
	}

	project.update((p) => ({
		...p,
		layers: sortLayers([...p.layers, { ...layer, id: crypto.randomUUID(), traits: [] }])
	}));
}

export function removeLayer(layerId: string): void {
	project.update((p) => ({
		...p,
		layers: p.layers.filter((layer) => layer.id !== layerId)
	}));
}

export function updateLayerName(layerId: string, name: string): void {
	project.update((p) => ({
		...p,
		layers: p.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer))
	}));
}

export function reorderLayers(reorderedLayers: Layer[]): void {
	project.update((p) => ({
		...p,
		layers: sortLayers(reorderedLayers)
	}));
}

// Get layers
export function getLayers(): Layer[] {
	const currentProject = get(project);
	return currentProject.layers;
}
