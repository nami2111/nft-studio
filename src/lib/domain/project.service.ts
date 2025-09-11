// src/lib/domain/project.service.ts

import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';
import { fileToArrayBuffer } from '$lib/utils';
import {
	isValidProjectName,
	isValidLayerName,
	isValidTraitName,
	isValidDimensions
} from '$lib/utils/validation';

/**
 * Validates a project name.
 * @param {string} name - The project name to validate
 * @returns {boolean} True if the project name is valid, false otherwise
 */
export function validateProjectName(name: string): boolean {
	return isValidProjectName(name) !== null;
}

/**
 * Validates a layer name.
 * @param {string} name - The layer name to validate
 * @returns {boolean} True if the layer name is valid, false otherwise
 */
export function validateLayerName(name: string): boolean {
	return isValidLayerName(name) !== null;
}

/**
 * Validates a trait name.
 * @param {string} name - The trait name to validate
 * @returns {boolean} True if the trait name is valid, false otherwise
 */
export function validateTraitName(name: string): boolean {
	return isValidTraitName(name) !== null;
}

export function validateDimensions(width: number, height: number): boolean {
	return isValidDimensions(width, height);
}

export function createDefaultProject(): Project {
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

export async function addTraitToLayer(
	layer: Layer,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<Trait> {
	if (!validateTraitName(trait.name)) {
		throw new Error('Invalid trait name: must be a non-empty string with maximum 100 characters');
	}

	const arrayBuffer = await fileToArrayBuffer(trait.imageData);
	const imageUrl = URL.createObjectURL(trait.imageData);

	return {
		...trait,
		id: crypto.randomUUID(),
		imageUrl,
		imageData: arrayBuffer
	};
}

export function removeTraitFromLayer(layer: Layer, traitId: string): Layer {
	return {
		...layer,
		traits: layer.traits.filter((trait) => trait.id !== traitId)
	};
}

export function updateTraitInLayer(layer: Layer, traitId: string, updates: Partial<Trait>): Layer {
	return {
		...layer,
		traits: layer.traits.map((trait) => (trait.id === traitId ? { ...trait, ...updates } : trait))
	};
}

export function addLayerToProject(project: Project, layer: Omit<Layer, 'id' | 'traits'>): Project {
	if (!validateLayerName(layer.name)) {
		throw new Error('Invalid layer name: must be a non-empty string with maximum 100 characters');
	}

	return {
		...project,
		layers: [...project.layers, { ...layer, id: crypto.randomUUID(), traits: [] }]
	};
}

export function removeLayerFromProject(project: Project, layerId: string): Project {
	return {
		...project,
		layers: project.layers.filter((layer) => layer.id !== layerId)
	};
}

export function updateLayerInProject(
	project: Project,
	layerId: string,
	updates: Partial<Layer>
): Project {
	return {
		...project,
		layers: project.layers.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer))
	};
}

export function reorderLayersInProject(project: Project, reorderedLayers: Layer[]): Project {
	return {
		...project,
		layers: reorderedLayers.sort((a, b) => a.order - b.order)
	};
}

export function updateProjectName(project: Project, name: string): Project {
	if (!validateProjectName(name)) {
		throw new Error('Invalid project name: must be a non-empty string with maximum 100 characters');
	}
	return { ...project, name };
}

export function updateProjectDescription(project: Project, description: string): Project {
	return { ...project, description };
}

export function updateProjectDimensions(project: Project, width: number, height: number): Project {
	if (!validateDimensions(width, height)) {
		throw new Error('Invalid dimensions: width and height must be positive numbers');
	}
	return { ...project, outputSize: { width, height } };
}

export function hasMissingImageData(layers: Layer[]): boolean {
	for (const layer of layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				return true;
			}
		}
	}
	return false;
}

export function getLayersWithMissingImages(
	layers: Layer[]
): Array<{ layerName: string; traitName: string }> {
	const missingImages: Array<{ layerName: string; traitName: string }> = [];
	for (const layer of layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				missingImages.push({ layerName: layer.name, traitName: trait.name });
			}
		}
	}
	return missingImages;
}
