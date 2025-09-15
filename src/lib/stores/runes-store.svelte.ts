import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';
import { LocalStorageStore } from '$lib/persistence/storage';
import { fileToArrayBuffer } from '$lib/utils';
import {
	isValidDimensions,
	isValidProjectName,
	isValidLayerName,
	isValidTraitName,
	isValidImportedProject,
	isValidRarityWeight
} from '$lib/utils/validation';
import { handleValidationError, handleFileError } from '$lib/utils/error-handler';
import JSZip from 'jszip';

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
		layers: [],
		_needsProperLoad: true
	};
}

// Create reactive state using Svelte 5 runes
/**
 * Reactive project state using Svelte 5 runes.
 */
export const project = $state<Project>(defaultProject());

/**
 * Reactive loading states using Svelte 5 runes.
 */
export const loadingStates = $state<Record<string, boolean>>({});

/**
 * Reactive detailed loading states using Svelte 5 runes.
 */
export const detailedLoadingStates = $state<Record<string, LoadingState>>({});

// Initialize from storage
LOCAL_STORE.load().then((stored) => {
	if (stored) {
		Object.assign(project, restoreBlobUrls(stored));
	}
});

// Auto-save functionality moved to AutoSave.svelte component

// Track object URLs to prevent memory leaks
const activeObjectUrls = new Set<string>();

// Helper functions
/**
 * Sanitizes a filename by removing invalid characters.
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename
 */
function sanitizeFilename(filename: string): string {
	// Remove invalid characters for filenames
	return filename.replace(/[/\\:*?"<>|]/g, '_');
}

function restoreBlobUrls(p: Project): Project {
	const restoredProject = { ...p };

	// Clean up any existing object URLs before creating new ones
	resourceManager.cleanup();

	for (const layer of restoredProject.layers) {
		for (const trait of layer.traits) {
			if (trait.imageData && trait.imageData.byteLength > 0) {
				// Only create new URL if we don't already have one for this data
				if (!trait.imageUrl || !resourceManager.getActiveObjectUrls().has(trait.imageUrl)) {
					if (trait.imageUrl) {
						try {
							URL.revokeObjectURL(trait.imageUrl);
						} catch {
							// Ignore cleanup errors
						}
					}
					const blob = new Blob([trait.imageData], { type: 'image/png' });
					const newUrl = URL.createObjectURL(blob);
					trait.imageUrl = newUrl;
					resourceManager.addObjectUrl(newUrl);
				}
			}
		}
	}

	return restoredProject;
}

function cleanupObjectUrls(): void {
	for (const url of activeObjectUrls) {
		try {
			URL.revokeObjectURL(url);
		} catch {
			// Ignore cleanup errors
		}
	}
	activeObjectUrls.clear();
}

function sortLayers(layers: Layer[]): Layer[] {
	return layers.sort((a, b) => a.order - b.order);
}

// Project functions
/**
 * Updates the project name.
 * @param {string} name - The new project name
 * @throws {Error} If the name is invalid
 */
export function updateProjectName(name: string): void {
	const sanitizedName = isValidProjectName(name);
	if (sanitizedName === null) {
		handleValidationError<void>(
			new Error('Invalid project name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateProjectName' }
			}
		);
		return;
	}
	project.name = sanitizedName;
}

/**
 * Updates the project description.
 * @param {string} description - The new project description
 */
export function updateProjectDescription(description: string): void {
	project.description = description;
}

/**
 * Updates the project dimensions.
 * @param {number} width - The new width in pixels
 * @param {number} height - The new height in pixels
 * @throws {Error} If the dimensions are invalid
 */
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
	project.outputSize = { width, height };
}

/**
 * Adds a new layer to the project.
 * @param {Omit<Layer, 'id' | 'traits'>} layer - The layer to add (without id and traits)
 * @throws {Error} If the layer name is invalid
 */
export function addLayer(layer: Omit<Layer, 'id' | 'traits'>): void {
	const sanitizedName = isValidLayerName(layer.name);
	if (sanitizedName === null) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'addLayer' }
			}
		);
		return;
	}

	project.layers = sortLayers([
		...project.layers,
		{ ...layer, name: sanitizedName, id: crypto.randomUUID(), traits: [] }
	]);
}

/**
 * Removes a layer from the project.
 * @param {string} layerId - The ID of the layer to remove
 */
export function removeLayer(layerId: string): void {
	project.layers = project.layers.filter((layer) => layer.id !== layerId);
}

/**
 * Updates the name of a layer.
 * @param {string} layerId - The ID of the layer to update
 * @param {string} name - The new name for the layer
 * @throws {Error} If the layer name is invalid
 */
export function updateLayerName(layerId: string, name: string): void {
	const sanitizedName = isValidLayerName(name);
	if (sanitizedName === null) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateLayerName' }
			}
		);
		return;
	}
	project.layers = project.layers.map((layer) =>
		layer.id === layerId ? { ...layer, name: sanitizedName } : layer
	);
}

/**
 * Reorders the layers in the project.
 * @param {Layer[]} reorderedLayers - The reordered layers
 */
export function reorderLayers(reorderedLayers: Layer[]): void {
	project.layers = sortLayers(reorderedLayers);
}

/**
 * Adds a new trait to a layer.
 * @param {string} layerId - The ID of the layer to add the trait to
 * @param {Omit<Trait, 'id' | 'imageData'> & { imageData: File }} trait - The trait to add
 * @returns {Promise<void>} A promise that resolves when the trait is added
 * @throws {Error} If the trait name is invalid
 */
export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<void> {
	const sanitizedName = isValidTraitName(trait.name);
	if (sanitizedName === null) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'addTrait' }
			}
		);
		return;
	}

	startDetailedLoading(`trait-upload-${layerId}`, `Uploading trait ${sanitizedName}...`);

	try {
		const arrayBuffer = await fileToArrayBuffer(trait.imageData);
		const imageUrl = URL.createObjectURL(trait.imageData);
		resourceManager.addObjectUrl(imageUrl);

		// Ensure rarityWeight is a valid integer between 1 and 5
		const validRarityWeight =
			trait.rarityWeight && isValidRarityWeight(trait.rarityWeight) ? trait.rarityWeight : 3; // Default to 3 (Epic) if not provided or invalid

		const newTrait: Trait = {
			...trait,
			name: sanitizedName,
			id: crypto.randomUUID(),
			imageUrl,
			imageData: arrayBuffer,
			rarityWeight: validRarityWeight
		};

		// Auto-set project output size based on first uploaded image
		const isFirstImage = project.layers.every((layer) => layer.traits.length === 0);

		if (isFirstImage && trait.width && trait.height) {
			project.outputSize = { width: trait.width, height: trait.height };
		}

		project.layers = project.layers.map((layer) => {
			if (layer.id === layerId) {
				return { ...layer, traits: [...layer.traits, newTrait] };
			}
			return layer;
		});
	} catch (error) {
		handleFileError(error, {
			context: { component: 'ProjectStore', action: 'addTrait' },
			title: 'Upload Failed',
			description: 'Failed to upload trait image. Please try again.'
		});
	} finally {
		stopDetailedLoading(`trait-upload-${layerId}`);
	}
}

/**
 * Removes a trait from a layer.
 * @param {string} layerId - The ID of the layer to remove the trait from
 * @param {string} traitId - The ID of the trait to remove
 */
export function removeTrait(layerId: string, traitId: string): void {
	// Revoke object URL for the trait being removed to avoid memory leaks
	try {
		const layer = project.layers.find((l) => l.id === layerId);
		const trait = layer?.traits.find((t) => t.id === traitId);
		if (trait?.imageUrl) {
			resourceManager.removeObjectUrl(trait.imageUrl);
		}
	} catch {
		// noop in non-browser contexts
	}

	project.layers = project.layers.map((layer) => {
		if (layer.id !== layerId) return layer;
		const nextTraits = layer.traits.filter((trait) => trait.id !== traitId);
		return { ...layer, traits: nextTraits };
	});
}

/**
 * Updates the name of a trait.
 * @param {string} layerId - The ID of the layer containing the trait
 * @param {string} traitId - The ID of the trait to update
 * @param {string} name - The new name for the trait
 * @throws {Error} If the trait name is invalid
 */
export function updateTraitName(layerId: string, traitId: string, name: string): void {
	const sanitizedName = isValidTraitName(name);
	if (sanitizedName === null) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateTraitName' }
			}
		);
		return;
	}
	project.layers = project.layers.map((layer) =>
		layer.id === layerId
			? {
					...layer,
					traits: layer.traits.map((trait) =>
						trait.id === traitId ? { ...trait, name: sanitizedName } : trait
					)
				}
			: layer
	);
}

/**
 * Updates the rarity weight of a trait.
 * @param {string} layerId - The ID of the layer containing the trait
 * @param {string} traitId - The ID of the trait to update
 * @param {number} rarityWeight - The new rarity weight (1-5)
 */
export function updateTraitRarity(layerId: string, traitId: string, rarityWeight: number): void {
	// Ensure rarityWeight is a valid integer between 1 and 5
	const validRarityWeight = Math.max(1, Math.min(5, Math.round(rarityWeight || 3)));

	if (!isValidRarityWeight(validRarityWeight)) {
		handleValidationError<void>(
			new Error('Invalid rarity weight: must be an integer between 1 and 5'),
			{
				context: { component: 'ProjectStore', action: 'updateTraitRarity' }
			}
		);
		return;
	}

	project.layers = project.layers.map((layer) =>
		layer.id === layerId
			? {
					...layer,
					traits: layer.traits.map((trait) =>
						trait.id === traitId ? { ...trait, rarityWeight: validRarityWeight } : trait
					)
				}
			: layer
	);
}

/**
 * Starts a loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 */
export function startLoading(key: string): void {
	loadingStates[key] = true;
}

/**
 * Stops a loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 */
export function stopLoading(key: string): void {
	loadingStates[key] = false;
}

/**
 * Resets all loading states.
 */
export function resetLoading(): void {
	for (const key in loadingStates) {
		delete loadingStates[key];
	}
}

// Save project to ZIP
/**
 * Saves the current project to a ZIP file.
 * @returns {Promise<void>} A promise that resolves when the project is saved
 */
export async function saveProjectToZip(): Promise<void> {
	startLoading('project-save');

	try {
		const zip = new JSZip();
		const currentProject = project;

		const projectConfig = {
			...currentProject,
			layers: currentProject.layers.map((layer: Layer) => ({
				...layer,
				traits: layer.traits.map((trait: Trait) => ({
					...trait,
					imageData: undefined
				}))
			})),
			exportedAt: new Date().toISOString()
		};

		zip.file('project.json', JSON.stringify(projectConfig, null, 2));

		for (const layer of currentProject.layers) {
			const layerFolder = zip.folder(sanitizeFilename(layer.name));
			if (layerFolder) {
				for (const trait of layer.traits) {
					if (trait.imageData && trait.imageData.byteLength > 0) {
						const safeTraitName = sanitizeFilename(trait.name);
						const blob = new Blob([trait.imageData], { type: 'image/png' });
						layerFolder.file(`${safeTraitName}.png`, blob);
					}
				}
			}
		}

		const content = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${sanitizeFilename(currentProject.name) || 'project'}.zip`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (error) {
		handleFileError(error, {
			context: { component: 'ProjectStore', action: 'saveProjectToZip' },
			title: 'Save Failed',
			description: 'Failed to save project to ZIP file. Please try again.'
		});
	} finally {
		stopLoading('project-save');
	}
}

// Load project from ZIP
/**
 * Loads a project from a ZIP file.
 * @param {File} file - The ZIP file to load
 * @returns {Promise<boolean>} A promise that resolves to true if the project was loaded successfully
 */
export async function loadProjectFromZip(file: File): Promise<boolean> {
	startLoading('project-load');

	try {
		const zip = new JSZip();
		const contents = await zip.loadAsync(file);

		const projectFile = contents.file('project.json');
		if (!projectFile) {
			throw new Error('Invalid project file: missing project.json');
		}

		const projectJson = await projectFile.async('text');
		const projectData = JSON.parse(projectJson);

		if (!isValidImportedProject(projectData)) {
			throw new Error('Invalid project file format');
		}

		const validatedProjectData = projectData as {
			id?: string;
			name: string;
			description?: string;
			outputSize?: { width: number; height: number };
			layers: Array<{
				id?: string;
				name: string;
				order?: number;
				traits: Array<{
					id?: string;
					name: string;
					rarityWeight?: number;
					imageData?: ArrayBuffer;
					imageUrl?: string;
					[key: string]: unknown;
				}>;
				[key: string]: unknown;
			}>;
			[key: string]: unknown;
		};

		const layersWithImages: Layer[] = [];
		const totalLayers = validatedProjectData.layers.length;
		let processedLayers = 0;

		for (const layer of validatedProjectData.layers) {
			const layerWithTraits: Layer = {
				id: layer.id || crypto.randomUUID(),
				name: layer.name,
				order: layer.order ?? 0,
				isOptional: layer.isOptional ? true : undefined,
				traits: []
			};

			const layerFolder = contents.folder(layer.name);
			if (layerFolder) {
				const totalTraits = layer.traits.length;
				let processedTraits = 0;

				for (const trait of layer.traits) {
					const traitFile = layerFolder.file(`${trait.name}.png`);
					if (traitFile) {
						const blob = await traitFile.async('blob');
						const imageData = await fileToArrayBuffer(blob as unknown as File);
						const imageUrl = URL.createObjectURL(blob);
						resourceManager.addObjectUrl(imageUrl);
						// Ensure rarityWeight is a valid integer between 1 and 5
						const traitRarityWeight = trait.rarityWeight as number;
						const validRarityWeight =
							traitRarityWeight && isValidRarityWeight(traitRarityWeight) ? traitRarityWeight : 3; // Default to 3 (Epic) if not provided or invalid
						layerWithTraits.traits.push({
							id: trait.id || crypto.randomUUID(),
							name: trait.name,
							imageData,
							imageUrl,
							width: (trait.width as number) || 0,
							height: (trait.height as number) || 0,
							rarityWeight: validRarityWeight
						});
					}
					processedTraits++;
					const progress = Math.round(
						((processedLayers + processedTraits / totalTraits) / totalLayers) * 100
					);
					updateLoadingProgress('project-load', progress, `Loading layer ${layer.name}...`);
				}
			}
			layersWithImages.push(layerWithTraits);
			processedLayers++;
			const progress = Math.round((processedLayers / totalLayers) * 100);
			updateLoadingProgress('project-load', progress, `Loaded layer ${layer.name}`);
		}

		// Calculate output size from the first trait with valid dimensions
		let outputSize = { width: 0, height: 0 };
		for (const layer of layersWithImages) {
			for (const trait of layer.traits) {
				if (trait.width > 0 && trait.height > 0) {
					outputSize = { width: trait.width, height: trait.height };
					break;
				}
			}
			if (outputSize.width > 0 && outputSize.height > 0) break;
		}

		project.name = validatedProjectData.name;
		project.description = validatedProjectData.description || '';
		project.outputSize = outputSize;
		project.layers = layersWithImages.map((layer: Layer) => ({
			...layer,
			id: layer.id || crypto.randomUUID(),
			traits: layer.traits.map((trait: Trait) => ({
				...trait,
				id: trait.id || crypto.randomUUID()
			}))
		}));

		return true;
	} catch (error) {
		handleFileError(error, {
			context: { component: 'ProjectStore', action: 'loadProjectFromZip' },
			title: 'Load Failed',
			description: 'Failed to load project from ZIP file. Please check the file and try again.'
		});
		return false;
	} finally {
		stopLoading('project-load');
	}
}

// Check if project needs proper loading from ZIP
export function projectNeedsZipLoad(): boolean {
	return project._needsProperLoad === true;
}

// Mark project as properly loaded
export function markProjectAsLoaded(): void {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { _needsProperLoad: _unused, ...projectWithoutFlag } = project;
	Object.assign(project, projectWithoutFlag);
}

// Enhanced loading state functions with better tracking
/**
 * Interface for detailed loading state information.
 */
export interface LoadingState {
	/** Whether the operation is currently loading */
	isLoading: boolean;
	/** Progress percentage (0-100) */
	progress?: number;
	/** Current status message */
	message?: string;
	/** Timestamp when the operation started */
	startTime?: number;
}

/**
 * Starts a detailed loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 * @param {string} [message] - Optional status message
 */
export function startDetailedLoading(key: string, message?: string): void {
	detailedLoadingStates[key] = {
		isLoading: true,
		message,
		progress: 0,
		startTime: Date.now()
	};
}

/**
 * Updates the progress of a loading operation.
 * @param {string} key - The key identifying the operation
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} [message] - Optional status message
 */
export function updateLoadingProgress(key: string, progress: number, message?: string): void {
	if (detailedLoadingStates[key]) {
		detailedLoadingStates[key].progress = progress;
		if (message) {
			detailedLoadingStates[key].message = message;
		}
	}
}

/**
 * Stops a detailed loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 */
export function stopDetailedLoading(key: string): void {
	if (detailedLoadingStates[key]) {
		detailedLoadingStates[key].isLoading = false;
		detailedLoadingStates[key].progress = 100;
	}
}

/**
 * Resets all detailed loading states.
 */
export function resetDetailedLoading(): void {
	for (const key in detailedLoadingStates) {
		delete detailedLoadingStates[key];
	}
}

// Helper function to get loading state
/**
 * Gets the loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 * @returns {boolean} Whether the operation is currently loading
 */
export function getLoadingState(key: string): boolean {
	return loadingStates[key] ?? false;
}

/**
 * Gets the detailed loading state for a specific operation.
 * @param {string} key - The key identifying the operation
 * @returns {LoadingState | undefined} The detailed loading state
 */
export function getDetailedLoadingState(key: string): LoadingState | undefined {
	return detailedLoadingStates[key];
}

// Enhanced cleanup functions
/**
 * Interface for resource cleanup management.
 */
export interface ResourceCleanup {
	/** Clean up all resources */
	cleanup(): void;
	/** Add an object URL to the resource manager */
	addObjectUrl(url: string): void;
	/** Remove an object URL from the resource manager */
	removeObjectUrl(url: string): void;
	/** Get all active object URLs */
	getActiveObjectUrls(): Set<string>;
}

/**
 * Resource manager for handling object URL cleanup.
 * @type {ResourceCleanup}
 */
export const resourceManager: ResourceCleanup = {
	cleanup(): void {
		cleanupObjectUrls();
	},

	addObjectUrl(url: string): void {
		activeObjectUrls.add(url);
	},

	removeObjectUrl(url: string): void {
		try {
			URL.revokeObjectURL(url);
			activeObjectUrls.delete(url);
		} catch {
			// Ignore cleanup errors
		}
	},

	getActiveObjectUrls(): Set<string> {
		return new Set(activeObjectUrls);
	}
};

// Cleanup function to revoke all object URLs and reset stores
/**
 * Cleans up all resources including object URLs and resets stores.
 */
export function cleanupAllResources(): void {
	// Clean up object URLs
	resourceManager.cleanup();

	// Reset loading states
	resetLoading();
	resetDetailedLoading();

	// Auto-save timeouts are now handled by AutoSave component
}

// Export additional store compatibility (for backward compatibility)
/**
 * Reactive store containing the current project state (legacy export).
 * @deprecated Use the `project` rune export instead
 */
export const projectStore = {
	subscribe: (fn: (value: Project) => void) => {
		$effect(() => fn(project));
		return { unsubscribe: () => {} };
	},
	set: (value: Project) => Object.assign(project, value),
	update: (fn: (value: Project) => Project) => Object.assign(project, fn(project))
};

/**
 * Reactive store containing the loading states for various operations (legacy export).
 * @deprecated Use the `loadingStates` rune export instead
 */
export const loadingStore = {
	subscribe: (fn: (value: Record<string, boolean>) => void) => {
		$effect(() => fn(loadingStates));
		return { unsubscribe: () => {} };
	},
	set: (value: Record<string, boolean>) => Object.assign(loadingStates, value),
	update: (fn: (value: Record<string, boolean>) => Record<string, boolean>) =>
		Object.assign(loadingStates, fn(loadingStates))
};

/**
 * Reactive store containing the detailed loading states for various operations (legacy export).
 * @deprecated Use the `detailedLoadingStates` rune export instead
 */
export const detailedLoadingStore = {
	subscribe: (fn: (value: Record<string, LoadingState>) => void) => {
		$effect(() => fn(detailedLoadingStates));
		return { unsubscribe: () => {} };
	},
	set: (value: Record<string, LoadingState>) => Object.assign(detailedLoadingStates, value),
	update: (fn: (value: Record<string, LoadingState>) => Record<string, LoadingState>) =>
		Object.assign(detailedLoadingStates, fn(detailedLoadingStates))
};
