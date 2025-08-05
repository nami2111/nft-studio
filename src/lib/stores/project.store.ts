import { writable } from 'svelte/store';
import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';

// Create a writable store for the Project
export const project = writable<Project>({
	id: crypto.randomUUID(),
	name: 'My NFT Collection',
	description: 'A collection of unique NFTs',
	outputSize: {
		width: 1024,
		height: 1024
	},
	layers: []
});

// Functions to update the store
export function updateProjectName(name: string) {
	project.update((p) => ({
		...p,
		name
	}));
}

export function updateProjectDescription(description: string) {
	project.update((p) => ({
		...p,
		description
	}));
}

export function updateProjectDimensions(width: number, height: number) {
	project.update((p) => ({
		...p,
		outputSize: { width, height }
	}));
}

export function addLayer(layer: Omit<Layer, 'id' | 'traits'>) {
	project.update((p) => ({
		...p,
		layers: [
			...p.layers,
			{
				...layer,
				id: crypto.randomUUID(),
				traits: []
			}
		]
	}));
}

export function removeLayer(layerId: string) {
	project.update((p) => ({
		...p,
		layers: p.layers.filter((layer) => layer.id !== layerId)
	}));
}

export function updateLayerName(layerId: string, name: string) {
	project.update((p) => ({
		...p,
		layers: p.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer))
	}));
}

export function addTrait(layerId: string, trait: Omit<Trait, 'id'>) {
	project.update((p) => ({
		...p,
		layers: p.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: [
							...layer.traits,
							{
								...trait,
								id: crypto.randomUUID()
							}
						]
					}
				: layer
		)
	}));
}

export function removeTrait(layerId: string, traitId: string) {
	project.update((p) => ({
		...p,
		layers: p.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.filter((trait) => trait.id !== traitId)
					}
				: layer
		)
	}));
}

export function updateTraitRarity(layerId: string, traitId: string, rarityWeight: number) {
	project.update((p) => ({
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

export function reorderLayers(reorderedLayers: Layer[]) {
	project.update((p) => ({
		...p,
		layers: reorderedLayers
	}));
}

// Helper function to convert File to ArrayBuffer
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = reject;
		reader.readAsArrayBuffer(file);
	});
}

// Interface for transferrable layer format
interface TransferrableTrait {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
}

interface TransferrableLayer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: TransferrableTrait[];
}

// Helper function to prepare layers for transfer to worker
export async function prepareLayersForWorker(layers: Layer[]): Promise<TransferrableLayer[]> {
	const transferrableLayers: TransferrableLayer[] = [];

	for (const layer of layers) {
		const transferrableTraits: TransferrableTrait[] = [];

		for (const trait of layer.traits) {
			// Convert File to ArrayBuffer for transfer
			const arrayBuffer = await fileToArrayBuffer(trait.imageData);

			transferrableTraits.push({
				id: trait.id,
				name: trait.name,
				imageData: arrayBuffer,
				rarityWeight: trait.rarityWeight
			});
		}

		transferrableLayers.push({
			id: layer.id,
			name: layer.name,
			order: layer.order,
			isOptional: layer.isOptional,
			traits: transferrableTraits
		});
	}

	return transferrableLayers;
}
