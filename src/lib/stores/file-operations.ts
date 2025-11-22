/**
 * File operations for project import/export
 * Handles ZIP file creation and loading for project persistence
 */

import type { Project, Layer, Trait } from '$lib/types/project';
import type { LayerId, TraitId } from '$lib/types/ids';
import { fileToArrayBuffer } from '$lib/utils';
import { validateImportedProject } from '$lib/domain/validation';
import { recoverableFileOperation, handleFileError } from '$lib/utils/error-handler';
import { withTiming, measureOperation } from '$lib/utils/performance-monitor';
import JSZip from 'jszip';
import { createProjectId, createLayerId, createTraitId } from '$lib/types/ids';
import { globalResourceManager } from './resource-manager';

/**
 * Save project to ZIP file format
 */
export async function saveProjectToZip(project: Project): Promise<ArrayBuffer> {
	return await measureOperation(
		async () => {
			const zip = new JSZip();

			// Create project metadata
			const projectData = {
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
				}))
			};

			zip.file('project.json', JSON.stringify(projectData, null, 2));

			// Wait for all image data to be loaded before saving
			await ensureAllImagesLoaded(project);

			// Add trait images
			for (const layer of project.layers) {
				for (const trait of layer.traits) {
					if (trait.imageData && trait.imageData.byteLength > 0) {
						const imagePath = `images/${layer.id}/${trait.id}.png`;
						zip.file(imagePath, trait.imageData);
					}
				}
			}

			return await zip.generateAsync({ type: 'arraybuffer' });
		},
		'file.saveProjectToZip',
		{
			layerCount: project.layers.length,
			traitCount: project.layers.reduce((sum, layer) => sum + layer.traits.length, 0),
			projectName: project.name
		}
	);
}

/**
 * Load project from ZIP file
 */
export async function loadProjectFromZip(file: File): Promise<Project> {
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

		// Process the stored project data and load trait images
		const storedProject = validationResult.data as Project;
		const originalLayerIds = new Map<string, string>();
		const originalTraitIds = new Map<string, string>();

		// Load image data for each trait, keeping track of original IDs
		for (const layer of storedProject.layers) {
			// Store original layer ID before potentially generating a new one
			const originalLayerId = layer.id;
			const newLayerId = createLayerId(crypto.randomUUID());
			originalLayerIds.set(originalLayerId, newLayerId);

			// Update layer ID
			layer.id = newLayerId;

			// Process each trait in the layer
			for (const trait of layer.traits) {
				// Store original trait ID before potentially generating a new one
				const originalTraitId = trait.id;
				const newTraitId = createTraitId(crypto.randomUUID());
				originalTraitIds.set(originalTraitId, newTraitId);

				// Update trait ID
				trait.id = newTraitId;

				// Load image data from ZIP using original IDs
				const imagePath = `images/${originalLayerId}/${originalTraitId}.png`;
				const imageFile = zip.file(imagePath);

				if (imageFile) {
					// Load the image data
					const imageData = await imageFile.async('arraybuffer');
					trait.imageData = imageData;

					// Create object URL for preview
					const blob = new Blob([imageData], { type: 'image/png' });
					trait.imageUrl = URL.createObjectURL(blob);
					globalResourceManager.addObjectUrl(trait.imageUrl);
				} else {
					// Create empty image data if file not found
					trait.imageData = new ArrayBuffer(0);
				}
			}
		}

		// Update ruler rules to reference new layer IDs
		for (const layer of storedProject.layers) {
			for (const trait of layer.traits) {
				if (trait.rulerRules) {
					trait.rulerRules = trait.rulerRules.map((rule) => ({
						layerId: (originalLayerIds.get(rule.layerId) || rule.layerId) as LayerId,
						allowedTraitIds: rule.allowedTraitIds.map(
							(traitId) => (originalTraitIds.get(traitId) || traitId) as TraitId
						),
						forbiddenTraitIds: rule.forbiddenTraitIds.map(
							(traitId) => (originalTraitIds.get(traitId) || traitId) as TraitId
						)
					}));
				}
			}
		}

		// Update project with new ID
		storedProject.id = createProjectId(crypto.randomUUID());
		storedProject._needsProperLoad = false;

		return storedProject;
	} catch (error) {
		await handleFileError(error, { description: 'Failed to load project from ZIP file' });
		throw error;
	}
}

/**
 * Ensure all image data is loaded before saving
 * Waits for any pending image loads to complete
 */
async function ensureAllImagesLoaded(project: Project): Promise<void> {
	const maxWaitTime = 5000; // 5 seconds max wait
	const startTime = Date.now();

	// Check if any traits have empty image data
	const hasEmptyImageData = () => {
		return project.layers.some((layer) =>
			layer.traits.some((trait) => !trait.imageData || trait.imageData.byteLength === 0)
		);
	};

	// Wait for all images to load or timeout
	while (hasEmptyImageData() && Date.now() - startTime < maxWaitTime) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	// Log warning if images didn't load in time
	if (hasEmptyImageData()) {
		console.warn(
			'Warning: Some images may not have loaded before saving. Traits with empty image data found.'
		);
	}
}
