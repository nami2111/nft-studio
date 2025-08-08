import { get } from 'svelte/store';
import { project } from '../project/project.store';
import type { Layer } from '$lib/types/layer';
import { sortLayers } from '$lib/stores/store-core';

// --- Layer Level Functions ---
export function addLayer(layer: Omit<Layer, 'id' | 'traits'>): void {
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
