/**
 * Modern Svelte 5 runes-based project store for NFT Studio
 * Focused on core state management and business logic
 */

import type { Project, Layer, Trait, ProjectDimensions } from '$lib/types/project';
import type { LayerId, TraitId } from '$lib/types/ids';
import { fileToArrayBuffer } from '$lib/utils';
import {
	validateDimensions,
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateRarityWeight
} from '$lib/domain/validation';
import { createProjectId, createLayerId, createTraitId } from '$lib/types/ids';
import { globalResourceManager } from './resource-manager';
import {
	saveProjectToZip as saveProjectToZipImpl,
	loadProjectFromZip as loadProjectFromZipImpl
} from './file-operations';
import { loadingStateManager } from './loading-state';

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

import type { LoadingState } from './loading-state';

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

// Resource management is handled by the dedicated resource manager
// Use globalResourceManager for URL tracking and cleanup

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
			globalResourceManager.removeObjectUrl(trait.imageUrl);
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

// Batch loading state to prevent multiple rapid updates
let pendingTraitUpdates = new Map<string, { trait: Trait; layer: Layer; file: File }>();

// Process pending trait updates in batches
function processPendingTraitUpdates() {
	if (pendingTraitUpdates.size === 0) return;

	const updates = Array.from(pendingTraitUpdates.values());
	pendingTraitUpdates.clear();

	// Process all pending updates
	Promise.all(
		updates.map(({ trait, layer, file }) =>
			fileToArrayBuffer(file)
				.then((arrayBuffer) => {
					trait.imageData = arrayBuffer;
					// Create object URL for preview
					const blob = new Blob([arrayBuffer], { type: file.type || 'image/png' });
					trait.imageUrl = URL.createObjectURL(blob);
					globalResourceManager.addObjectUrl(trait.imageUrl);
					return { trait, layer };
				})
				.catch((error) => {
					console.error(`Failed to load image for trait: ${trait.name}`, error);
					// Remove the trait if loading fails
					const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
					if (traitIndex !== -1) {
						layer.traits.splice(traitIndex, 1);
					}
					return null;
				})
		)
	).then((results) => {
		// Force a single reactivity update after all traits are loaded
		const validResults = results.filter((r): r is { trait: Trait; layer: Layer } => r !== null);
		for (const { trait, layer } of validResults) {
			const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
			if (traitIndex !== -1) {
				layer.traits[traitIndex] = trait;
			}
		}
	});
}

// Debounced batch processing
let batchTimeoutId: number | null = null;
const BATCH_DELAY_MS = 100;

function scheduleBatchUpdate() {
	if (batchTimeoutId) {
		clearTimeout(batchTimeoutId);
	}
	batchTimeoutId = setTimeout(() => {
		processPendingTraitUpdates();
		batchTimeoutId = null;
	}, BATCH_DELAY_MS);
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

	// Add to pending updates for batch processing
	pendingTraitUpdates.set(newTrait.id, { trait: newTrait, layer, file });
	scheduleBatchUpdate();
}

export function removeTrait(layerId: LayerId, traitId: TraitId): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	const traitIndex = layer.traits.findIndex((trait: Trait) => trait.id === traitId);
	if (traitIndex === -1) return;

	// Clean up object URL
	const trait = layer.traits[traitIndex];
	if (trait.imageUrl) {
		globalResourceManager.removeObjectUrl(trait.imageUrl);
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

// Loading state management - delegated to loading state manager
export function startLoading(operation: string): void {
	loadingStateManager.startLoading(operation);
}

export function stopLoading(operation: string): void {
	loadingStateManager.stopLoading(operation);
}

export function getLoadingState(operation: string): boolean {
	return loadingStateManager.getLoadingState(operation);
}

export function startDetailedLoading(operation: string, total: number = 100): void {
	loadingStateManager.startDetailedLoading(operation, total);
}

export function updateDetailedLoading(operation: string, progress: number, message?: string): void {
	loadingStateManager.updateDetailedLoading(operation, progress, message);
}

export function stopDetailedLoading(operation: string, success: boolean = true): void {
	loadingStateManager.stopDetailedLoading(operation, success);
}

export function getDetailedLoadingState(operation: string): LoadingState | undefined {
	return loadingStateManager.getDetailedLoadingState(operation);
}

// Project persistence - delegated to file operations module
export async function saveProjectToZip(): Promise<ArrayBuffer> {
	startLoading('project-save');
	startDetailedLoading('project-save', 100);

	try {
		// Save using the file operations module
		const result = await saveProjectToZipImpl(project);

		stopDetailedLoading('project-save');
		stopLoading('project-save');
		return result;
	} catch (error) {
		stopDetailedLoading('project-save', false);
		stopLoading('project-save');
		throw error;
	}
}

export async function loadProjectFromZip(file: File): Promise<void> {
	try {
		startLoading('project-load');
		startDetailedLoading('project-load', 100);

		// Clean up existing resources before loading new project
		globalResourceManager.cleanup();

		// Load project using the dedicated file operations module
		const loadedProject = await loadProjectFromZipImpl(file);

		// Update project state
		project.id = loadedProject.id;
		project.name = loadedProject.name;
		project.description = loadedProject.description || '';
		project.outputSize = loadedProject.outputSize || { width: 0, height: 0 };
		project.layers = loadedProject.layers;
		project._needsProperLoad = false;

		stopDetailedLoading('project-load');
		stopLoading('project-load');
	} catch (error) {
		stopDetailedLoading('project-load', false);
		stopLoading('project-load');
		throw error;
	}
}

export function markProjectAsLoaded(): void {
	project._needsProperLoad = false;
}

// Cleanup
export function cleanupAllResources(): void {
	globalResourceManager.cleanup();
}
