// src/lib/domain/project.service.ts

import type { Project, Layer, Trait } from '$lib/types/project';
import { fileToArrayBuffer } from '$lib/utils';
import {
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateDimensions,
	validateRarityWeight,
	validateImportedProject
} from './validation';
import { handleValidationError, handleFileError } from '$lib/utils/error-handler';
import { createProjectId, createLayerId, createTraitId } from '$lib/types/ids';

/**
 * Create a new project with default values
 */
export function createProject(): Project {
	const project: Project = {
		id: createProjectId(crypto.randomUUID()),
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: {
			width: 0,
			height: 0
		},
		layers: []
	};

	return project;
}

/**
 * Add a new layer to the project
 */
export function addLayer(project: Project, name: string = 'New Layer'): Project {
	if (!validateLayerName(name)) {
		throw new Error('Invalid layer name');
	}

	const newLayer: Layer = {
		id: createLayerId(crypto.randomUUID()),
		name,
		order: project.layers.length,
		traits: []
	};

	return {
		...project,
		layers: [...project.layers, newLayer]
	};
}

/**
 * Remove a layer from the project
 */
export function removeLayer(project: Project, layerId: string): Project {
	const filteredLayers = project.layers.filter((layer) => layer.id !== layerId);

	// Reorder remaining layers
	const reorderedLayers = filteredLayers.map((layer, index) => ({
		...layer,
		order: index
	}));

	return {
		...project,
		layers: reorderedLayers
	};
}

/**
 * Update layer name
 */
export function updateLayerName(project: Project, layerId: string, name: string): Project {
	if (!validateLayerName(name)) {
		throw new Error('Invalid layer name');
	}

	return {
		...project,
		layers: project.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer))
	};
}

/**
 * Reorder layers in the project
 */
export function reorderLayers(project: Project, layerIds: string[]): Project {
	const newLayers: Layer[] = [];

	layerIds.forEach((layerId, index) => {
		const layer = project.layers.find((l) => l.id === layerId);
		if (layer) {
			newLayers.push({ ...layer, order: index });
		}
	});

	return {
		...project,
		layers: newLayers
	};
}

/**
 * Add a trait to a layer
 */
export async function addTrait(
	project: Project,
	layerId: string,
	file: File,
	name?: string
): Promise<Project> {
	const traitName = name || file.name.replace(/\.[^/.]+$/, '');
	if (!validateTraitName(traitName)) {
		throw new Error('Invalid trait name');
	}

	const layer = project.layers.find((layer) => layer.id === layerId);
	if (!layer) {
		throw new Error(`Layer with id ${layerId} not found`);
	}

	try {
		const arrayBuffer = await fileToArrayBuffer(file);

		const newTrait: Trait = {
			id: createTraitId(crypto.randomUUID()),
			name: traitName,
			imageData: arrayBuffer,
			rarityWeight: 1
		};

		return {
			...project,
			layers: project.layers.map((l) =>
				l.id === layerId
					? {
							...l,
							traits: [...l.traits, newTrait]
						}
					: l
			)
		};
	} catch (error) {
		await handleFileError(error, {
			operation: 'addTrait',
			context: { layerId, fileName: file.name }
		});
		throw error;
	}
}

/**
 * Remove a trait from a layer
 */
export function removeTrait(project: Project, layerId: string, traitId: string): Project {
	return {
		...project,
		layers: project.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.filter((trait) => trait.id !== traitId)
					}
				: layer
		)
	};
}

/**
 * Update trait name
 */
export function updateTraitName(
	project: Project,
	layerId: string,
	traitId: string,
	name: string
): Project {
	if (!validateTraitName(name)) {
		throw new Error('Invalid trait name');
	}

	return {
		...project,
		layers: project.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.map((trait) => (trait.id === traitId ? { ...trait, name } : trait))
					}
				: layer
		)
	};
}

/**
 * Update trait rarity weight
 */
export function updateTraitRarity(
	project: Project,
	layerId: string,
	traitId: string,
	rarityWeight: number
): Project {
	if (!validateRarityWeight(rarityWeight)) {
		throw new Error('Invalid rarity weight');
	}

	return {
		...project,
		layers: project.layers.map((layer) =>
			layer.id === layerId
				? {
						...layer,
						traits: layer.traits.map((trait) =>
							trait.id === traitId ? { ...trait, rarityWeight } : trait
						)
					}
				: layer
		)
	};
}

/**
 * Update project name
 */
export function updateProjectName(project: Project, name: string): Project {
	if (!validateProjectName(name)) {
		throw new Error('Invalid project name');
	}

	return {
		...project,
		name
	};
}

/**
 * Update project description
 */
export function updateProjectDescription(project: Project, description: string): Project {
	return {
		...project,
		description
	};
}

/**
 * Update project dimensions
 */
export function updateProjectDimensions(project: Project, width: number, height: number): Project {
	if (!validateDimensions(width, height)) {
		throw new Error('Invalid dimensions');
	}

	return {
		...project,
		outputSize: { width, height }
	};
}

/**
 * Validate project structure
 */
export function validateProjectStructure(project: Project): boolean {
	try {
		const validation = validateImportedProject(project);
		return validation.success;
	} catch {
		return false;
	}
}

/**
 * Calculate total possible combinations
 */
export function calculateTotalCombinations(project: Project): number {
	if (project.layers.length === 0) return 0;

	return project.layers.reduce((total, layer) => {
		return total * Math.max(layer.traits.length, 1);
	}, 1);
}

/**
 * Check if project can generate NFTs
 */
export function canGenerateNFTs(project: Project): boolean {
	return (
		project.layers.length > 0 &&
		project.outputSize.width > 0 &&
		project.outputSize.height > 0 &&
		project.layers.every((layer) => layer.traits.length > 0)
	);
}
