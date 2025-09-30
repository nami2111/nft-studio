/**
 * Modern Svelte 5 runes-based project store for NFT Studio
 * Fully leverages Svelte 5 runes for reactive state management
 */

import type { Project, Layer, Trait, ProjectDimensions } from '$lib/types/project';
import type { LayerId, TraitId } from '$lib/types/ids';
import { fileToArrayBuffer } from '$lib/utils';
import {
	validateDimensions,
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateImportedProject,
	validateRarityWeight
} from '$lib/domain/validation';
import { handleFileError } from '$lib/utils/error-handler';
import JSZip from 'jszip';
import { createProjectId, createLayerId, createTraitId } from '$lib/types/ids';

// Local storage key
// const PROJECT_STORAGE_KEY = 'nft-studio-project';

// Default project
function defaultProject(): Project {
	return {
		id: createProjectId(crypto.randomUUID()),
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: {
			width: 0,
			height: 0
		},
		layers: [],
		_needsProperLoad: true
	};
}

// Reactive state using Svelte 5 runes
export const project = $state<Project>(defaultProject());

export const loadingStates = $state<Record<string, boolean>>({});

export interface LoadingState {
	progress: number;
	total: number;
	message: string;
	status: 'idle' | 'loading' | 'success' | 'error';
}

export const detailedLoadingStates = $state<Record<string, LoadingState>>({});

// Derived state functions
export function isProjectValid(): boolean {
	return (
		project.name.length > 0 &&
		project.outputSize.width > 0 &&
		project.outputSize.height > 0 &&
		project.layers.every((layer: Layer) => layer.traits.length > 0)
	);
}

export function totalTraitCount(): number {
	return project.layers.reduce((sum: number, layer: Layer) => sum + layer.traits.length, 0);
}

export function projectNeedsZipLoad(): boolean {
	return project._needsProperLoad ?? true;
}

// Resource management for object URLs
class ResourceManager {
	private objectUrls = new Set<string>();

	addObjectUrl(url: string): void {
		this.objectUrls.add(url);
	}

	cleanup(): void {
		this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.objectUrls.clear();
	}
}

const resourceManager = new ResourceManager();

// Project management functions
export function updateProjectName(name: string): void {
	const result = validateProjectName(name);
	if (!result.success) {
		throw new Error(result.error);
	}
	project.name = name;
}

export function updateProjectDescription(description: string): void {
	project.description = description;
}

export function updateProjectDimensions(dimensions: ProjectDimensions): void {
	const result = validateDimensions(dimensions.width, dimensions.height);
	if (!result.success) {
		throw new Error(result.error);
	}
	project.outputSize = dimensions;
}

// Layer management functions
export function addLayer(name: string): void {
	const result = validateLayerName(name);
	if (!result.success) {
		throw new Error(result.error);
	}

	const newLayer: Layer = {
		id: createLayerId(crypto.randomUUID()),
		name,
		order: project.layers.length,
		traits: []
	};

	project.layers.push(newLayer);
}

export function removeLayer(layerId: LayerId): void {
	const layerIndex = project.layers.findIndex((layer: Layer) => layer.id === layerId);
	if (layerIndex === -1) return;

	// Clean up object URLs for traits in this layer
	const layer = project.layers[layerIndex];
	layer.traits.forEach((trait: Trait) => {
		if (trait.imageUrl) {
			URL.revokeObjectURL(trait.imageUrl);
		}
	});

	// Remove the layer
	project.layers.splice(layerIndex, 1);

	// Reorder remaining layers
	project.layers.forEach((layer: Layer, index: number) => {
		layer.order = index;
	});
}

export function updateLayerName(layerId: LayerId, name: string): void {
	const result = validateLayerName(name);
	if (!result.success) {
		throw new Error(result.error);
	}

	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	layer.name = name;
}

export function reorderLayers(layerIds: LayerId[]): void {
	const newLayers: Layer[] = [];

	layerIds.forEach((layerId: LayerId, index: number) => {
		const layer = project.layers.find((l: Layer) => l.id === layerId);
		if (layer) {
			layer.order = index;
			newLayers.push(layer);
		}
	});

	project.layers = newLayers;
}

// Trait management functions
export function addTrait(layerId: LayerId, file: File): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) {
		throw new Error(`Layer with ID ${layerId} not found`);
	}

	// Extract trait name from filename (remove extension) before validation
	const traitName = file.name.replace(/\.[^/.]+$/, '');
	const result = validateTraitName(traitName);
	if (!result.success) {
		throw new Error(result.error);
	}

	const newTrait: Trait = {
		id: createTraitId(crypto.randomUUID()),
		name: traitName,
		imageData: new ArrayBuffer(0), // Will be populated async
		rarityWeight: 1
	};

	layer.traits.push(newTrait);

	// Load image data asynchronously
	fileToArrayBuffer(file)
		.then((arrayBuffer) => {
			newTrait.imageData = arrayBuffer;
			// Create object URL for preview
			const blob = new Blob([arrayBuffer], { type: 'image/png' });
			newTrait.imageUrl = URL.createObjectURL(blob);
			resourceManager.addObjectUrl(newTrait.imageUrl);

			// Force reactivity by reassigning the trait in the array
			const traitIndex = layer.traits.findIndex((t: Trait) => t.id === newTrait.id);
			if (traitIndex !== -1) {
				layer.traits[traitIndex] = newTrait;
			}
		})
		.catch(() => {
			// Remove the trait if loading fails
			const traitIndex = layer.traits.findIndex((t: Trait) => t.id === newTrait.id);
			if (traitIndex !== -1) {
				layer.traits.splice(traitIndex, 1);
			}
		});
}

export function removeTrait(layerId: LayerId, traitId: TraitId): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	const traitIndex = layer.traits.findIndex((trait: Trait) => trait.id === traitId);
	if (traitIndex === -1) return;

	// Clean up object URL
	const trait = layer.traits[traitIndex];
	if (trait.imageUrl) {
		URL.revokeObjectURL(trait.imageUrl);
	}

	layer.traits.splice(traitIndex, 1);
}

export function updateTraitName(layerId: LayerId, traitId: TraitId, name: string): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	const trait = layer.traits.find((trait: Trait) => trait.id === traitId);
	if (!trait) return;

	const result = validateTraitName(name);
	if (!result.success) {
		throw new Error(result.error);
	}

	trait.name = name;
}

export function updateTraitRarity(layerId: LayerId, traitId: TraitId, rarityWeight: number): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	const trait = layer.traits.find((trait: Trait) => trait.id === traitId);
	if (!trait) return;

	const result = validateRarityWeight(rarityWeight);
	if (!result.success) {
		throw new Error(result.error);
	}

	trait.rarityWeight = rarityWeight;
}

// Loading state management
export function startLoading(operation: string): void {
	loadingStates[operation] = true;
}

export function stopLoading(operation: string): void {
	loadingStates[operation] = false;
}

export function getLoadingState(operation: string): boolean {
	return loadingStates[operation] || false;
}

export function startDetailedLoading(operation: string, total: number = 100): void {
	detailedLoadingStates[operation] = {
		progress: 0,
		total,
		message: 'Starting...',
		status: 'loading'
	};
}

export function updateDetailedLoading(operation: string, progress: number, message?: string): void {
	const state = detailedLoadingStates[operation];
	if (state) {
		state.progress = progress;
		if (message) {
			state.message = message;
		}
	}
}

export function stopDetailedLoading(operation: string, success: boolean = true): void {
	const state = detailedLoadingStates[operation];
	if (state) {
		state.status = success ? 'success' : 'error';
		state.progress = state.total;
	}
}

export function getDetailedLoadingState(operation: string): LoadingState | undefined {
	return detailedLoadingStates[operation];
}

// Project persistence
export async function saveProjectToZip(): Promise<ArrayBuffer> {
	const zip = new JSZip();

	// Create project metadata
	const projectData = {
		name: project.name,
		description: project.description,
		outputSize: project.outputSize,
		layers: project.layers.map((layer: Layer) => ({
			name: layer.name,
			order: layer.order,
			traits: layer.traits.map((trait: Trait) => ({
				name: trait.name,
				rarityWeight: trait.rarityWeight
			}))
		}))
	};

	zip.file('project.json', JSON.stringify(projectData, null, 2));

	// Add trait images
	for (const layer of project.layers) {
		for (const trait of layer.traits) {
			const imagePath = `images/${layer.id}/${trait.id}.png`;
			zip.file(imagePath, trait.imageData);
		}
	}

	return await zip.generateAsync({ type: 'arraybuffer' });
}

export async function loadProjectFromZip(file: File): Promise<void> {
	try {
		const arrayBuffer = await fileToArrayBuffer(file);
		const zip = await JSZip.loadAsync(arrayBuffer);

		// Read project metadata
		const projectFile = zip.file('project.json');
		if (!projectFile) {
			throw new Error('Project metadata not found in ZIP file');
		}

		const projectData = JSON.parse(await projectFile.async('text'));

		// Validate imported project
		const validationResult = validateImportedProject(projectData);
		if (!validationResult.success) {
			throw new Error(validationResult.error);
		}

		// Clean up existing object URLs
		resourceManager.cleanup();

		// Restore object URLs for traits
		const storedProject = validationResult.data as Project;
		storedProject.layers.forEach((layer: Layer) => {
			layer.traits.forEach((trait: Trait) => {
				if (trait.imageData && !trait.imageUrl) {
					const blob = new Blob([trait.imageData], { type: 'image/png' });
					trait.imageUrl = URL.createObjectURL(blob);
					resourceManager.addObjectUrl(trait.imageUrl);
				}
			});
		});

		// Update project state
		project.id = createProjectId(crypto.randomUUID());
		project.name = storedProject.name;
		project.description = storedProject.description;
		project.outputSize = storedProject.outputSize;
		project.layers = storedProject.layers;
		project._needsProperLoad = false;
	} catch (error) {
		throw handleFileError(error, { description: 'Failed to load project from ZIP file' });
	}
}

export function markProjectAsLoaded(): void {
	project._needsProperLoad = false;
}

// Cleanup
export function cleanupAllResources(): void {
	resourceManager.cleanup();
}
