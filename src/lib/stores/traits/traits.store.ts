import { get } from 'svelte/store';
import { project } from '../project/project.store';
import { fileToArrayBuffer, normalizeFilename } from '$lib/utils';
import type { Trait } from '$lib/types/trait';
import type { Layer } from '$lib/types/layer';
import { handleError, handleFileError, handleValidationError } from '$lib/utils/error-handler';
import { isValidImportedProject, isValidTraitName } from '$lib/utils/validation';
import { defaultProject } from '../project/project.model';

// --- Trait Level Functions ---
export async function addTrait(
	layerId: string,
	trait: Omit<Trait, 'id' | 'imageData'> & { imageData: File }
): Promise<void> {
	if (!isValidTraitName(trait.name)) {
		handleValidationError<void>(
			new Error('Invalid trait name: must be a non-empty string with maximum 100 characters'),
			{
				context: { component: 'TraitsStore', action: 'addTrait' }
			}
		);
		return;
	}
	
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
export function revokeAllTraitObjectUrls(): void {
	try {
		const current = get(project);
		for (const layer of current.layers) {
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

// Prepare layers for transfer to worker
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

// Save project to ZIP
export async function saveProjectToZip(): Promise<void> {
	// Import loading store dynamically to avoid circular dependencies
	const { loadingStore } = await import('$lib/stores/loading.store');
	loadingStore.start('project-save');
	
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

	try {
		const content = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${currentProject.name || 'project'}.zip`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (error) {
		handleFileError(error, {
			context: { component: 'TraitStore', action: 'saveProjectToZip' },
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
	
	const { default: JSZip } = await import('jszip');

	try {
		const zip = await JSZip.loadAsync(file);

		const projectFile = zip.file('project.json');
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
			const layerFolder = zip.folder(layer.name);
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
		project.set({
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
			context: { component: 'TraitStore', action: 'loadProjectFromZip' },
			title: 'Load Failed',
			description: 'Failed to load project from ZIP file. Please check the file and try again.'
		});
		return false;
	} finally {
		loadingStore.stop('project-load');
	}
}
