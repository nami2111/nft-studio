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

// --- Utility Functions ---
function sortLayers(layers: Layer[]): Layer[] {
	return layers.sort((a, b) => a.order - b.order);
}

// --- Project Level Functions ---
export function updateProjectName(name: string) {
	project.update((p) => ({ ...p, name }));
}

export function updateProjectDescription(description: string) {
	project.update((p) => ({ ...p, description }));
}

export function updateProjectDimensions(width: number, height: number) {
	project.update((p) => ({ ...p, outputSize: { width, height } }));
}

// --- Layer Level Functions ---
export function addLayer(layer: Omit<Layer, 'id' | 'traits'>) {
	project.update((p) => ({
		...p,
		layers: sortLayers([...p.layers, { ...layer, id: crypto.randomUUID(), traits: [] }])
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

export function reorderLayers(reorderedLayers: Layer[]) {
	project.update((p) => ({
		...p,
		layers: sortLayers(reorderedLayers)
	}));
}

// --- Trait Level Functions ---
export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
) {
	const arrayBuffer = await fileToArrayBuffer(trait.imageData);

	const newTrait: Trait = {
		...trait,
		id: crypto.randomUUID(),
		imageUrl: trait.imageUrl || '',
		imageData: arrayBuffer
	};

	project.update((p) => {
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

export function removeTrait(layerId: string, traitId: string) {
	project.update((p) => ({
		...p,
		layers: p.layers.map((layer) =>
			layer.id === layerId
				? { ...layer, traits: layer.traits.filter((trait) => trait.id !== traitId) }
				: layer
		)
	}));
}

export function updateTraitName(layerId: string, traitId: string, name: string) {
	project.update((p) => ({
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

// --- Worker Preparation ---
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return await file.arrayBuffer();
}

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

export async function prepareLayersForWorker(layers: Layer[]): Promise<TransferrableLayer[]> {
	const transferrableLayers = await Promise.all(
		layers.map(async (layer) => {
			const transferrableTraits = await Promise.all(
				layer.traits.map(async (trait) => ({
					id: trait.id,
					name: trait.name,
					imageData: trait.imageData,
					rarityWeight: trait.rarityWeight
				}))
			);
			return {
				id: layer.id,
				name: layer.name,
				order: layer.order,
				isOptional: layer.isOptional,
				traits: transferrableTraits
			};
		})
	);
	return transferrableLayers;
}
