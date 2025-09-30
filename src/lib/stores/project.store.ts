/**
 * Modern Svelte 5 runes-based project store for NFT Studio
 * Fully leverages Svelte 5 runes for reactive state management
 */

import type { Project, Layer, Trait, ProjectDimensions } from '$lib/types/project';
import type { LayerId, TraitId, ProjectId } from '$lib/types/ids';
import { LocalStorageStore } from '$lib/persistence/storage';
import { fileToArrayBuffer } from '$lib/utils';
import {
	validateDimensions,
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateImportedProject,
	validateRarityWeight
} from '$lib/domain/validation';
import { handleValidationError, handleFileError } from '$lib/utils/error-handler';
import JSZip from 'jszip';
import { createProjectId, createLayerId, createTraitId } from '$lib/types/ids';

// Local storage key
const PROJECT_STORAGE_KEY = 'nft-studio-project';
const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY);

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

export const activeObjectUrls = $state<Set<string>>(new Set());

// Derived state using $derived
export const projectIsValid = $derived(
	project.layers.length > 0 &&
	project.outputSize.width > 0 &&
	project.outputSize.height > 0 &&
	project.layers.every(layer => layer.traits.length > 0)
);

export const totalTraitCount = $derived(
	project.layers.reduce((sum, layer) => sum + layer.traits.length, 0)
);

export const hasLayers = $derived(project.layers.length > 0);

export const canGenerate = $derived(
	hasLayers && project.outputSize.width > 0 && project.outputSize.height > 0
);

// Resource management
interface ResourceCleanup {
	cleanup(): void;
	addObjectUrl(url: string): void;
	removeObjectUrl(url: string): void;
	getActiveObjectUrls(): string[];
}

const resourceManager: ResourceCleanup = {
	cleanup() {
		activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
		activeObjectUrls.clear();
	},

	addObjectUrl(url: string) {
		activeObjectUrls.add(url);
	},

	removeObjectUrl(url: string) {
		if (activeObjectUrls.has(url)) {
			URL.revokeObjectURL(url);
			activeObjectUrls.delete(url);
		}
	},

	getActiveObjectUrls() {
		return Array.from(activeObjectUrls);
	}
};

// Project management functions
export function updateProjectName(name: string): void {
	const validation = validateProjectName(name);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	project.name = name;
	saveProjectToStorage();
}

export function updateProjectDescription(description: string): void {
	project.description = description;
	saveProjectToStorage();
}

export function updateProjectDimensions(dimensions: ProjectDimensions): void {
	const validation = validateDimensions(dimensions);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	project.outputSize = dimensions;
	saveProjectToStorage();
}

// Layer management functions
export function addLayer(name: string = 'New Layer'): LayerId {
	const validation = validateLayerName(name);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	const layer: Layer = {
		id: createLayerId(crypto.randomUUID()),
		name,
		order: project.layers.length,
		traits: []
	};

	project.layers.push(layer);
	saveProjectToStorage();
	return layer.id;
}

export function removeLayer(layerId: LayerId): void {
	const layerIndex = project.layers.findIndex(layer => layer.id === layerId);
	if (layerIndex === -1) return;

	// Clean up object URLs for traits in this layer
	const layer = project.layers[layerIndex];
	layer.traits.forEach(trait => {
		if (trait.imageUrl) {
			resourceManager.removeObjectUrl(trait.imageUrl);
		}
	});

	project.layers.splice(layerIndex, 1);

	// Reorder remaining layers
	project.layers.forEach((layer, index) => {
		layer.order = index;
	});

	saveProjectToStorage();
}

export function updateLayerName(layerId: LayerId, name: string): void {
	const validation = validateLayerName(name);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	const layer = project.layers.find(layer => layer.id === layerId);
	if (!layer) return;

	layer.name = name;
	saveProjectToStorage();
}

export function reorderLayers(layerIds: LayerId[]): void {
	const newLayers: Layer[] = [];

	layerIds.forEach((layerId, index) => {
		const layer = project.layers.find(l => l.id === layerId);
		if (layer) {
			layer.order = index;
			newLayers.push(layer);
		}
	});

	project.layers = newLayers;
	saveProjectToStorage();
}

// Trait management functions
export async function addTrait(
	layerId: LayerId,
	file: File,
	name?: string
): Promise<TraitId> {
	const traitName = name || file.name.replace(/\.[^/.]+$/, '');
	const validation = validateTraitName(traitName);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	const layer = project.layers.find(layer => layer.id === layerId);
	if (!layer) {
		throw new Error(`Layer with id ${layerId} not found`);
	}

	try {
		const arrayBuffer = await fileToArrayBuffer(file);

		// Create object URL for preview
		const blob = new Blob([arrayBuffer], { type: file.type });
		const imageUrl = URL.createObjectURL(blob);
		resourceManager.addObjectUrl(imageUrl);

		const trait: Trait = {
			id: createTraitId(crypto.randomUUID()),
			name: traitName,
			imageData: arrayBuffer,
			imageUrl,
			rarityWeight: 1
		};

		layer.traits.push(trait);
		saveProjectToStorage();
		return trait.id;
	} catch (error) {
		await handleFileError(error, {
			operation: 'addTrait',
			context: { layerId, fileName: file.name }
		});
		throw error;
	}
}

export function removeTrait(layerId: LayerId, traitId: TraitId): void {
	const layer = project.layers.find(layer => layer.id === layerId);
	if (!layer) return;

	const traitIndex = layer.traits.findIndex(trait => trait.id === traitId);
	if (traitIndex === -1) return;

	const trait = layer.traits[traitIndex];
	if (trait.imageUrl) {
		resourceManager.removeObjectUrl(trait.imageUrl);
	}

	layer.traits.splice(traitIndex, 1);
	saveProjectToStorage();
}

export function updateTraitName(layerId: LayerId, traitId: TraitId, name: string): void {
	const validation = validateTraitName(name);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	const layer = project.layers.find(layer => layer.id === layerId);
	if (!layer) return;

	const trait = layer.traits.find(trait => trait.id === traitId);
	if (!trait) return;

	trait.name = name;
	saveProjectToStorage();
}

export function updateTraitRarity(layerId: LayerId, traitId: TraitId, rarityWeight: number): void {
	const validation = validateRarityWeight(rarityWeight);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	const layer = project.layers.find(layer => layer.id === layerId);
	if (!layer) return;

	const trait = layer.traits.find(trait => trait.id === traitId);
	if (!trait) return;

	trait.rarityWeight = rarityWeight;
	saveProjectToStorage();
}

// Loading state management
export function startLoading(operation: string): void {
	loadingStates[operation] = true;
}

export function stopLoading(operation: string): void {
	loadingStates[operation] = false;
}

export function resetLoading(): void {
	for (const key in loadingStates) {
		loadingStates[key] = false;
	}
}

export function startDetailedLoading(operation: string, total: number = 100): void {
	detailedLoadingStates[operation] = {
		progress: 0,
		total,
		message: 'Starting...',
		status: 'loading'
	};
}

export function updateLoadingProgress(operation: string, progress: number, message?: string): void {
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
		state.message = success ? 'Completed' : 'Failed';
	}
}

export function resetDetailedLoading(): void {
	for (const key in detailedLoadingStates) {
		detailedLoadingStates[key] = {
			progress: 0,
			total: 100,
			message: '',
			status: 'idle'
		};
	}
}

export function getLoadingState(operation: string): boolean {
	return loadingStates[operation] || false;
}

export function getDetailedLoadingState(operation: string): LoadingState | undefined {
	return detailedLoadingStates[operation];
}

// Storage management
function saveProjectToStorage(): void {
	try {
		LOCAL_STORE.set(project);
	} catch (error) {
		console.error('Failed to save project to storage:', error);
	}
}

export function loadProjectFromStorage(): void {
	try {
		const storedProject = LOCAL_STORE.get();
		if (storedProject) {
			// Validate the stored project
			const validation = validateImportedProject(storedProject);
			if (validation.success) {
				// Clean up existing object URLs
				resourceManager.cleanup();

				// Restore object URLs for traits
				storedProject.layers.forEach(layer => {
					layer.traits.forEach(trait => {
						if (trait.imageData && !trait.imageUrl) {
							const blob = new Blob([trait.imageData], { type: 'image/png' });
							trait.imageUrl = URL.createObjectURL(blob);
							resourceManager.addObjectUrl(trait.imageUrl);
						}
					});
				});

				Object.assign(project, storedProject);
			} else {
				console.warn('Invalid project data in storage:', validation.error);
				// Reset to default project if stored data is invalid
				Object.assign(project, defaultProject());
			}
		}
	} catch (error) {
		console.error('Failed to load project from storage:', error);
		Object.assign(project, defaultProject());
	}
}

export function clearProject(): void {
	resourceManager.cleanup();
	Object.assign(project, defaultProject());
	LOCAL_STORE.clear();
}

// ZIP export/import functions
export async function saveProjectToZip(): Promise<ArrayBuffer> {
	const zip = new JSZip();

	// Add project metadata
	zip.file('project.json', JSON.stringify({
		name: project.name,
		description: project.description,
		outputSize: project.outputSize,
		layers: project.layers.map(layer => ({
			name: layer.name,
			order: layer.order,
			traits: layer.traits.map(trait => ({
				name: trait.name,
				rarityWeight: trait.rarityWeight
			}))
		}))
	}, null, 2));

	// Add trait images
	for (const layer of project.layers) {
		const layerFolder = zip.folder(layer.name);
		if (layerFolder) {
			for (const trait of layer.traits) {
				const fileName = `${trait.name}.png`;
				layerFolder.file(fileName, trait.imageData);
			}
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
		const validation = validateImportedProject(projectData);
		if (!validation.success) {
			throw new Error(`Invalid project data: ${validation.error}`);
		}

		// Clean up existing project
		resourceManager.cleanup();

		// Load trait images
		const layers: Layer[] = [];
		for (const layerData of projectData.layers) {
			const layer: Layer = {
				id: createLayerId(crypto.randomUUID()),
				name: layerData.name,
				order: layerData.order,
				traits: []
			};

			const layerFolder = zip.folder(layerData.name);
			if (layerFolder) {
				for (const traitData of layerData.traits) {
					const traitFile = layerFolder.file(`${traitData.name}.png`);
					if (traitFile) {
						const imageData = await traitFile.async('arraybuffer');
						const blob = new Blob([imageData], { type: 'image/png' });
						const imageUrl = URL.createObjectURL(blob);
						resourceManager.addObjectUrl(imageUrl);

						const trait: Trait = {
							id: createTraitId(crypto.randomUUID()),
							name: traitData.name,
							imageData,
							imageUrl,
							rarityWeight: traitData.rarityWeight || 1
						};

						layer.traits.push(trait);
					}
				}
			}

			layers.push(layer);
		}

		// Update project state
		Object.assign(project, {
			id: createProjectId(crypto.randomUUID()),
			name: projectData.name,
			description: projectData.description,
			outputSize: projectData.outputSize,
			layers,
			_needsProperLoad: false
		});

		saveProjectToStorage();
	} catch (error) {
		await handleFileError(error, {
			operation: 'loadProjectFromZip',
			context: { fileName: file.name }
		});
		throw error;
	}
}

export function projectNeedsZipLoad(): boolean {
	return project._needsProperLoad || false;
}

export function markProjectAsLoaded(): void {
	project._needsProperLoad = false;
}

// Cleanup on app unmount
export function cleanupAllResources(): void {
	resourceManager.cleanup();
}

// Initialize project from storage on module load
loadProjectFromStorage();
