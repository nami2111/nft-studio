/**
 * File operations for project import/export.
 *
 * Public API:
 *   - {@link saveProjectToZip}   — serialize to ZIP via worker
 *   - {@link loadProjectFromZip} — read ZIP, return ready-to-use Project
 *   - {@link ProjectImporter}    — interface for future import formats
 *
 * ID remapping, ruler-rule rewriting, and image hydration are handled
 * internally during load. Callers receive a Project they can render directly.
 */

import { validateImportedProject } from '$lib/domain/validation';
import type { LayerId, TraitId } from '$lib/types/ids';
import { createLayerId, createProjectId, createTraitId } from '$lib/types/ids';
import type { Layer, Project, Trait } from '$lib/types/project';
import { fileToArrayBuffer } from '$lib/utils';
import { handleTypedError } from '$lib/utils/error-handler';
import { measureOperation } from '$lib/utils/performance-monitor';
import JSZip from 'jszip';
import { globalResourceManager } from './resource-manager';

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
const IMAGE_LOAD_TIMEOUT_MS = 5000;

export interface ProjectImporter {
	canImport(file: File): boolean;
	import(file: File): Promise<Project>;
}

// ============================================================================
// Save
// ============================================================================

export async function saveProjectToZip(project: Project): Promise<ArrayBuffer> {
	return measureOperation(
		async () => {
			await ensureAllImagesLoaded(project);

			const projectData = stripImageData(project);
			const { imageFiles, transferables } = collectImageFiles(project);

			return offloadZipToWorker(projectData, imageFiles, transferables);
		},
		'file.saveProjectToZip',
		{
			layerCount: project.layers.length,
			traitCount: project.layers.reduce((sum, layer) => sum + layer.traits.length, 0),
			projectName: project.name
		}
	);
}

function stripImageData(project: Project) {
	return {
		name: project.name,
		description: project.description,
		outputSize: project.outputSize,
		layers: project.layers.map((layer: Layer) => ({
			id: layer.id,
			name: layer.name,
			order: layer.order,
			isOptional: layer.isOptional,
			traits: layer.traits.map((trait: Trait) => ({
				id: trait.id,
				name: trait.name,
				rarityWeight: trait.rarityWeight,
				type: trait.type,
				rulerRules: trait.rulerRules
			}))
		})),
		strictPairConfig: project.strictPairConfig
	};
}

function collectImageFiles(project: Project): {
	imageFiles: Array<{ path: string; data: ArrayBuffer }>;
	transferables: ArrayBuffer[];
} {
	const imageFiles: Array<{ path: string; data: ArrayBuffer }> = [];
	const transferables: ArrayBuffer[] = [];

	for (const layer of project.layers) {
		for (const trait of layer.traits) {
			if (trait.imageData && trait.imageData.byteLength > 0) {
				imageFiles.push({
					path: `images/${layer.id}/${trait.id}.png`,
					data: trait.imageData
				});
				transferables.push(trait.imageData);
			}
		}
	}

	return { imageFiles, transferables };
}

function offloadZipToWorker(
	projectData: unknown,
	imageFiles: Array<{ path: string; data: ArrayBuffer }>,
	_transferables: ArrayBuffer[]
): Promise<ArrayBuffer> {
	return new Promise<ArrayBuffer>((resolve, reject) => {
		const worker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), {
			type: 'module'
		});

		const taskId = `zip-${Date.now()}`;

		worker.onmessage = (e: MessageEvent) => {
			const { type, payload } = e.data;
			if (type === 'zip-complete') {
				worker.terminate();
				resolve(payload.buffer);
			} else if (type === 'zip-error') {
				worker.terminate();
				reject(new Error(payload.message));
			}
		};

		worker.onerror = (err) => {
			worker.terminate();
			reject(err);
		};

		worker.postMessage({
			type: 'zip-project',
			taskId,
			payload: {
				projectData: JSON.stringify(projectData),
				imageFiles
			}
		});
	});
}

async function ensureAllImagesLoaded(project: Project): Promise<void> {
	const startTime = Date.now();

	const hasEmptyImageData = () =>
		project.layers.some((layer) =>
			layer.traits.some((trait) => !trait.imageData || trait.imageData.byteLength === 0)
		);

	while (hasEmptyImageData() && Date.now() - startTime < IMAGE_LOAD_TIMEOUT_MS) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	if (hasEmptyImageData()) {
		console.warn(
			'Warning: Some images may not have loaded before saving. Traits with empty image data found.'
		);
	}
}

// ============================================================================
// Load
// ============================================================================

export async function loadProjectFromZip(file: File): Promise<Project> {
	try {
		validateZipFile(file);

		if (import.meta.env.DEV) {
			console.log(
				`[loadProjectFromZip] Starting load: ${file.name} (${Math.round(file.size / 1024)}KB)`
			);
		}

		const arrayBuffer = await fileToArrayBuffer(file, 3, 150);
		const zip = await JSZip.loadAsync(arrayBuffer);

		const project = await parseAndHydrateProject(zip, file.name);
		return finalizeImportedProject(project);
	} catch (error) {
		await handleTypedError(error, 'file', { description: 'Failed to load project from ZIP file' });
		throw error;
	}
}

function validateZipFile(file: File): void {
	if (!file) {
		throw new Error('No file provided. Please select a ZIP file to load.');
	}
	if (!file.name) {
		throw new Error('Invalid file: missing filename');
	}
	if (!file.name.toLowerCase().endsWith('.zip')) {
		throw new Error(`Invalid file type: "${file.name}". Please select a valid .zip project file.`);
	}
	if (file.size === 0) {
		throw new Error(`File "${file.name}" is empty. Please select a valid project file.`);
	}
	if (file.size > MAX_FILE_SIZE_BYTES) {
		throw new Error(
			`File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). ` +
				`Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`
		);
	}

	if (
		file.type &&
		file.type !== 'application/zip' &&
		file.type !== 'application/x-zip-compressed'
	) {
		console.warn(`[loadProjectFromZip] Unexpected MIME type: ${file.type} for ${file.name}`);
	}
}

async function parseAndHydrateProject(zip: JSZip, fileName: string): Promise<Project> {
	const projectFile = zip.file('project.json');
	if (!projectFile) {
		throw new Error(
			`Invalid project file: "project.json" not found in ${fileName}. ` +
				`This file may be corrupted or is not a valid GNStudio project file.`
		);
	}

	const projectData = JSON.parse(await projectFile.async('text'));
	const validationResult = validateImportedProject(projectData);
	if (!validationResult.success) {
		throw new Error(`Invalid project structure in ${fileName}: ${validationResult.error}`);
	}

	const storedProject = validationResult.data as Project;
	const idRemap = remapProjectIds(storedProject);
	await hydrateTraitImages(zip, storedProject, idRemap);
	rewriteRulerRules(storedProject, idRemap);
	rewriteStrictPairConfig(storedProject, idRemap);

	return storedProject;
}

interface IdRemap {
	layers: Map<string, string>;
	traits: Map<string, string>;
}

function remapProjectIds(project: Project): IdRemap {
	const layers = new Map<string, string>();
	const traits = new Map<string, string>();

	for (const layer of project.layers) {
		const originalLayerId = layer.id;
		const newLayerId = createLayerId(crypto.randomUUID());
		layers.set(originalLayerId, newLayerId);
		layer.id = newLayerId;

		for (const trait of layer.traits) {
			const originalTraitId = trait.id;
			const newTraitId = createTraitId(crypto.randomUUID());
			traits.set(originalTraitId, newTraitId);
			trait.id = newTraitId;
		}
	}

	return { layers, traits };
}

async function hydrateTraitImages(zip: JSZip, project: Project, remap: IdRemap): Promise<void> {
	// Build reverse maps so we can find original IDs for ZIP paths
	const newToOriginalLayer = new Map<string, string>();
	const newToOriginalTrait = new Map<string, string>();
	for (const [original, next] of remap.layers) newToOriginalLayer.set(next, original);
	for (const [original, next] of remap.traits) newToOriginalTrait.set(next, original);

	for (const layer of project.layers) {
		const originalLayerId = newToOriginalLayer.get(layer.id) ?? layer.id;

		for (const trait of layer.traits) {
			const originalTraitId = newToOriginalTrait.get(trait.id) ?? trait.id;
			const imagePath = `images/${originalLayerId}/${originalTraitId}.png`;
			const imageFile = zip.file(imagePath);

			if (!imageFile) {
				console.error(`[loadProjectFromZip] Image not found in ZIP: ${imagePath}`);
				trait.imageData = new ArrayBuffer(0);
				continue;
			}

			const imageData = await imageFile.async('arraybuffer');
			trait.imageData = imageData;

			const blob = new Blob([imageData], { type: 'image/png' });
			trait.imageUrl = URL.createObjectURL(blob);
			globalResourceManager.addObjectUrl(trait.imageUrl);
		}
	}
}

function rewriteRulerRules(project: Project, remap: IdRemap): void {
	for (const layer of project.layers) {
		for (const trait of layer.traits) {
			if (!trait.rulerRules) continue;

			trait.rulerRules = trait.rulerRules.map((rule) => ({
				layerId: (remap.layers.get(rule.layerId) ?? rule.layerId) as LayerId,
				allowedTraitIds: rule.allowedTraitIds.map(
					(traitId) => (remap.traits.get(traitId) ?? traitId) as TraitId
				),
				forbiddenTraitIds: rule.forbiddenTraitIds.map(
					(traitId) => (remap.traits.get(traitId) ?? traitId) as TraitId
				)
			}));
		}
	}
}

function rewriteStrictPairConfig(project: Project, remap: IdRemap): void {
	if (!project.strictPairConfig) return;

	project.strictPairConfig = {
		...project.strictPairConfig,
		layerCombinations: project.strictPairConfig.layerCombinations.map((combination) => ({
			...combination,
			layerIds: combination.layerIds.map(
				(layerId) => (remap.layers.get(layerId) ?? layerId) as LayerId
			)
		}))
	};
}

function finalizeImportedProject(project: Project): Project {
	project.id = createProjectId(crypto.randomUUID());
	project._needsProperLoad = false;
	return project;
}

// ============================================================================
// ProjectImporter adapter — enables future formats
// ============================================================================

export const zipImporter: ProjectImporter = {
	canImport: (file) => file.name.toLowerCase().endsWith('.zip'),
	import: loadProjectFromZip
};
