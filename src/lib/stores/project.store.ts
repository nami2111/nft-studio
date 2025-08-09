import { writable, get } from 'svelte/store';
import { LocalStorageStore } from '$lib/persistence/storage';
import { fileToArrayBuffer, normalizeFilename } from '$lib/utils';
import { isValidImportedProject, isValidDimensions } from '$lib/utils/validation';
import {
	handleError,
	handleStorageError,
	handleFileError,
	handleValidationError
} from '$lib/utils/error-handler';
import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';

// Prepared layer/trait types for worker transfer
export interface PreparedTrait {
	id: string;
	name: string;
	rarityWeight: number;
	imageData: ArrayBuffer;
}

export interface PreparedLayer {
	id: string;
	name: string;
	order: number;
	traits: PreparedTrait[];
}

// Prepare layers for transfer to worker
export function prepareLayersForWorker(layers: Layer[]): PreparedLayer[] {
	return layers.map((layer) => ({
		id: layer.id,
		name: layer.name,
		order: layer.order,
		traits: layer.traits.map((trait) => ({
			id: trait.id,
			name: trait.name,
			rarityWeight: trait.rarityWeight,
			imageData: trait.imageData
		}))
	}));
}

// Local storage key
const PROJECT_STORAGE_KEY = 'nft-studio-project'; // migrated to persistence layer (localStorage) if needed

const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY);

// Load project from storage asynchronously; start with a default and then hydrate
function defaultProject(): Project {
	return {
		id: crypto.randomUUID(),
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: {
			width: 1024,
			height: 1024
		},
		layers: []
	};
}

// Create a writable store for the Project with a sane initial value
const initial = defaultProject();
export const project = writable<Project>(initial);

// Hydrate from storage if available
LOCAL_STORE.load().then((stored) => {
	if (stored) {
		project.set(stored);
	}
});

// Save project to localStorage via persistence layer
function saveProjectToStorage(projectData: Project) {
	LOCAL_STORE.save(projectData);
}

// Auto-save to localStorage on project changes
project.subscribe((p) => {
	saveProjectToStorage(p);
});

// --- Utility Functions ---
function sortLayers(layers: Layer[]): Layer[] {
	return layers.sort((a, b) => a.order - b.order);
}

// --- Project Level Functions ---
export function updateProjectName(name: string): void {
	if (!isValidProjectName(name)) {
		handleValidationError<void>(
			new Error('Invalid project name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateProjectName' }
			}
		);
		return;
	}
	project.update((p) => ({ ...p, name }));
}

export function updateProjectDescription(description: string): void {
	project.update((p) => ({ ...p, description }));
}

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
	project.update((p) => ({ ...p, outputSize: { width, height } }));
}

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
	if (!isValidLayerName(name)) {
		handleValidationError<void>(
			new Error('Invalid layer name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateLayerName' }
			}
		);
		return;
	}
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

// --- Trait Level Functions ---
export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<void> {
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

export function removeTrait(layerId: string, traitId: string): void {
	// Revoke object URL for the trait being removed to avoid memory leaks
	try {
		const current = get(project);
		const layer = current.layers.find((l) => l.id === layerId);
		const trait = layer?.traits.find((t) => t.id === traitId);
		if (trait?.imageUrl) {
			URL.revokeObjectURL(trait.imageUrl);
		}
	} catch {
		// noop in non-browser contexts
	}

	project.update((p) => {
		return {
			...p,
			layers: p.layers.map((layer) => {
				if (layer.id !== layerId) return layer;
				const nextTraits = layer.traits.filter((trait) => trait.id !== traitId);
				return { ...layer, traits: nextTraits };
			})
		};
	});
}

export function updateTraitName(layerId: string, traitId: string, name: string): void {
	if (!isValidTraitName(name)) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'ProjectStore', action: 'updateTraitName' }
			}
		);
		return;
	}
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

export function updateTraitRarity(layerId: string, traitId: string, rarityWeight: number): void {
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

// Revoke all object URLs stored on traits. Intended for use before full project resets.
function revokeAllTraitObjectUrls(p: Project): void {
	try {
		for (const layer of p.layers) {
			for (const trait of layer.traits) {
				if (trait.imageUrl) {
					URL.revokeObjectURL(trait.imageUrl);
				}
			}
		}
	} catch {
		// noop
	}
}

// --- Project Management Functions ---
export function clearStoredProject(): void {
	try {
		const current = get(project);
		revokeAllTraitObjectUrls(current);
	} catch (error) {
		handleError(error, {
			context: {
				component: 'ProjectStore',
				action: 'clearStoredProject',
				userAction: 'revokeAllTraitObjectUrls'
			},
			silent: true
		});
	}

	try {
		LOCAL_STORE.clear();
	} catch (error) {
		handleStorageError(error, {
			context: {
				component: 'ProjectStore',
				action: 'clearStoredProject',
				userAction: 'clearLocalStorage'
			},
			description: 'Failed to clear project from storage. Please try again.'
		});
	}
}

export function exportProjectData(): string {
	try {
		const currentProject = get(project);
		const exportData = {
			...currentProject,
			layers: currentProject.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => ({
					...trait,
					imageData: undefined
				}))
			})),
			exportedAt: new Date().toISOString()
		};
		return JSON.stringify(exportData, null, 2);
	} catch (error) {
		handleError(error, {
			context: { component: 'ProjectStore', action: 'exportProjectData' },
			title: 'Export Failed',
			description: 'Failed to export project data. Please try again.'
		});
		return '';
	}
}

export function importProjectData(projectJson: string): boolean {
	try {
		const importedData = JSON.parse(projectJson);
		if (!isValidImportedProject(importedData)) {
			handleValidationError(new Error('Invalid project format'), {
				context: { component: 'ProjectStore', action: 'importProjectData' },
				title: 'Import Failed',
				description: 'The project file format is invalid. Please check the file and try again.'
			});
			return false;
		}
		// Type assertion since we've validated the structure
		project.set(importedData as unknown as Project);
		return true;
	} catch (error) {
		handleError(error, {
			context: { component: 'ProjectStore', action: 'importProjectData' },
			title: 'Import Failed',
			description: 'Failed to import project data. Please check the file and try again.'
		});
		return false;
	}
}

// Check if project needs proper loading from ZIP
export function projectNeedsZipLoad(): boolean {
	const currentProject = get(project);
	return currentProject._needsProperLoad === true;
}

// Mark project as properly loaded
export function markProjectAsLoaded(): void {
	project.update((p) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _needsProperLoad: _, ...projectWithoutFlag } = p;
		return projectWithoutFlag as Project;
	});
}

// Check if project has missing image data
export function hasMissingImageData(): boolean {
	const currentProject = get(project);
	for (const layer of currentProject.layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				return true;
			}
		}
	}
	return false;
}

// Get layers with missing image data
export function getLayersWithMissingImages(): Array<{ layerName: string; traitName: string }> {
	const currentProject = get(project);
	const missingImages: Array<{ layerName: string; traitName: string }> = [];

	for (const layer of currentProject.layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				missingImages.push({ layerName: layer.name, traitName: trait.name });
			}
		}
	}
	return missingImages;
}

// Save project to ZIP
export async function saveProjectToZip(): Promise<void> {
	// Import loading store dynamically to avoid circular dependencies
	const { loadingStore } = await import('$lib/stores/loading.store');
	loadingStore.start('project-save');
	
	try {
		const { default: JSZip } = await import('jszip');
		const currentProject = get(project);

		const zip = new JSZip();

		const projectConfig = {
			...currentProject,
			layers: currentProject.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => ({
					...trait,
					imageData: undefined
				}))
			})),
			exportedAt: new Date().toISOString()
		};

		zip.file('project.json', JSON.stringify(projectConfig, null, 2));

		for (const layer of currentProject.layers) {
			const layerFolder = zip.folder(normalizeFilename(layer.name));
			if (layerFolder) {
				for (const trait of layer.traits) {
					if (trait.imageData && trait.imageData.byteLength > 0) {
						const safeTraitName = normalizeFilename(trait.name);
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
		a.download = `${currentProject.name || 'project'}.zip`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (error) {
		handleFileError(error, {
			context: { component: 'ProjectStore', action: 'saveProjectToZip' },
			title: 'Save Failed',
			description: 'Failed to save project to ZIP file. Please try again.'
		});
	} finally {
		loadingStore.stop('project-save');
	}
}

// Load project from ZIP
export async function loadProjectFromZip(file: File): Promise<boolean> {
	// Import loading store dynamically to avoid circular dependencies
	const { loadingStore } = await import('$lib/stores/loading.store');
	loadingStore.start('project-load');
	
	try {
		const { default: JSZip } = await import('jszip');

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

		// Load images for each trait
		for (const layer of projectData.layers) {
			const layerFolder = contents.folder(layer.name);
			if (layerFolder) {
				for (const trait of layer.traits) {
					const traitFile = layerFolder.file(`${trait.name}.png`);
					if (traitFile) {
						const blob = await traitFile.async('blob');
						trait.imageData = await fileToArrayBuffer(blob as unknown as File);
						trait.imageUrl = URL.createObjectURL(blob);
					}
				}
			}
		}

		// Update the project store with the loaded data
		setProject({
			...projectData,
			// Ensure we have proper IDs for all entities
			layers: projectData.layers.map((layer: any) => ({
				...layer,
				id: layer.id || crypto.randomUUID(),
				traits: layer.traits.map((trait: any) => ({
					...trait,
					id: trait.id || crypto.randomUUID()
				}))
			}))
		});

		return true;
	} catch (error) {
		handleFileError(error, {
			context: { component: 'ProjectStore', action: 'loadProjectFromZip' },
			title: 'Load Failed',
			description: 'Failed to load project from ZIP file. Please check the file and try again.'
		});
		return false;
	} finally {
		loadingStore.stop('project-load');
	}
}
