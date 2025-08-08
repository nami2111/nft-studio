import { writable, get } from 'svelte/store';
import { LocalStorageStore } from '$lib/persistence/storage';
import type { Project } from '$lib/types/project';
import type { Layer } from '$lib/types/layer';
import type { Trait } from '$lib/types/trait';

function normalizeFilename(name: string): string {
	// Remove path separators, trim, limit length, and allow common safe chars
	const trimmed = name.trim().slice(0, 100);
	return trimmed.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/[\\/]+/g, '_');
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
	project.update((p) => ({ ...p, name }));
}

export function updateProjectDescription(description: string): void {
	project.update((p) => ({ ...p, description }));
}

export function updateProjectDimensions(width: number, height: number): void {
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
					traits: layer.traits.map((trait) => (trait.id === traitId ? { ...trait, rarityWeight } : trait))
			}
				: layer
		)
	}));
}

// --- Worker Preparation ---
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return await file.arrayBuffer();
}

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
	} catch {
		// ignore
	}

	try {
		LOCAL_STORE.clear();
	} catch (error) {
		console.warn('Failed to clear project from storage:', error);
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
		console.error('Failed to export project data:', error);
		return '';
	}
}

/**
 * Validates the shape of a project object imported from JSON.
 * Accepts well-formed projects or projects that have missing image data (as images are stripped during export).
 */
export function isValidImportedProject(data: any): boolean {
	if (!data || typeof data !== 'object') return false;
	if (typeof data.id !== 'string' || typeof data.name !== 'string') return false;
	if (!Array.isArray(data.layers)) return false;
	for (const layer of data.layers) {
		if (typeof layer.id !== 'string' || typeof layer.name !== 'string') return false;
		if (layer.order !== undefined && typeof layer.order !== 'number') return false;
		if (!Array.isArray(layer.traits)) return false;
		for (const trait of layer.traits) {
			if (typeof trait.id !== 'string' || typeof trait.name !== 'string') return false;
			// imageData may be missing (export strips image data)
		}
	}
	// outputSize may be present; if present ensure width/height are numbers
	if (data.outputSize) {
		const o = data.outputSize;
		if (typeof o.width !== 'number' || typeof o.height !== 'number') return false;
	}
	return true;
}

export function importProjectData(projectJson: string): boolean {
	try {
		const importedData = JSON.parse(projectJson);
		if (!isValidImportedProject(importedData)) {
			throw new Error('Invalid project format');
		}
		project.set(importedData);
		return true;
	} catch (error) {
		console.error('Failed to import project data:', error);
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
		const { _needsProperLoad: _unused, ...projectWithoutFlag } = p;
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
}

// Load project from ZIP
export async function loadProjectFromZip(file: File): Promise<boolean> {
	const { default: JSZip } = await import('jszip');

	try {
		const zip = await JSZip.loadAsync(file);

		const configFile = zip.file('project.json');
		if (!configFile) {
			throw new Error('Invalid project file: missing project.json');
		}

		const configContent = await configFile.async('text');
		const projectConfig = JSON.parse(configContent);

		for (const layer of projectConfig.layers) {
			const layerFolder = zip.folder(layer.name);
			if (layerFolder) {
				for (const trait of layer.traits) {
					const imageFile = layerFolder.file(`${trait.name}.png`);
					if (imageFile) {
						const imageData = await imageFile.async('arraybuffer');
						trait.imageData = imageData;
					} else {
						trait.imageData = new ArrayBuffer(0);
					}
				}
			}
		}

		try {
			const current = get(project);
			revokeAllTraitObjectUrls(current);
		} catch {
			// ignore
		}

		project.set(projectConfig);
		return true;
	} catch (error) {
		console.error('Failed to load project from ZIP:', error);
		return false;
	}
}

// Helper declarations
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return await file.arrayBuffer();
}
