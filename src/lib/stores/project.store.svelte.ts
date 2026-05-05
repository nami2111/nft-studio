/**
 * Modern Svelte 5 runes-based project store
 * Focused on core state management and business logic
 *
 * @note The `project` export is intentionally a module-level singleton.
 * This app is a single-session SPA (no SSR, no multi-user), so a global
 * singleton is appropriate. If multi-instance support is ever needed,
 * migrate to Svelte context (setContext/getContext).
 */

import { SvelteMap } from 'svelte/reactivity';
import { calculateAdaptiveDelay } from '$lib/config/performance.config';
import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import type { LayerId, ProjectId, TraitId } from '$lib/types/ids';
import { createLayerId, createTraitId } from '$lib/types/ids';
import type { StrictPairConfig } from '$lib/types/layer';
import type { Layer, Project, ProjectDimensions, Trait } from '$lib/types/project';
import { fileToArrayBuffer } from '$lib/utils';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { persistenceService } from '../services/persistence.service';
import { validationService } from '../services/validation.service';
import {
	loadProjectFromZip as loadProjectFromZipImpl,
	saveProjectToZip as saveProjectToZipImpl
} from './file-operations';
import { loadingStateManager } from './loading-state';
import { globalResourceManager } from './resource-manager';

// Initialize project with a fresh default project.
// Auto-load disabled: users must manually load saved projects via "Load Project" button.
export const project = $state<Project>(validationService.createDefaultProject());

// Export a simple store wrapper for components
export const projectStore = {
	get currentProject() {
		return project;
	},
	updateStrictPairConfig,
	getStrictPairConfig,
	isStrictPairEnabled,
	getActiveLayerCombinations
};

// Enhanced state setters with automatic persistence
export function updateProject(updates: Partial<Project>): void {
	Object.assign(project, updates);
	persistenceService.markDirty(); // metadata dirty
	persistenceService.schedulePersist(project);
}

export function updateLayer(layerId: LayerId, updates: Partial<Layer>): void {
	const layerIndex = project.layers.findIndex((l) => l.id === layerId);
	if (layerIndex !== -1) {
		Object.assign(project.layers[layerIndex], updates);
		persistenceService.markDirty(layerId);
		persistenceService.schedulePersist(project);
	}
}

export function updateTrait(layerId: LayerId, traitId: TraitId, updates: Partial<Trait>): void {
	const layer = project.layers.find((l) => l.id === layerId);
	if (layer) {
		const traitIndex = layer.traits.findIndex((t) => t.id === traitId);
		if (traitIndex !== -1) {
			Object.assign(layer.traits[traitIndex], updates);
			persistenceService.markDirty(layerId);
			persistenceService.schedulePersist(project);
		}
	}
}

// Batch update system for multiple operations
interface BatchUpdate {
	layerId?: LayerId;
	traitId?: TraitId;
	updates: Partial<Project | Layer | Trait>;
	type: 'project' | 'layer' | 'trait';
}

let batchQueue: BatchUpdate[] = [];
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

function processBatchQueue(): void {
	if (batchQueue.length === 0) return;

	const updates = [...batchQueue];
	batchQueue = [];

	// Apply all updates and track dirty layers
	for (const update of updates) {
		switch (update.type) {
			case 'project':
				Object.assign(project, update.updates);
				persistenceService.markDirty();
				break;
			case 'layer':
				if (update.layerId) {
					const layerIndex = project.layers.findIndex((l) => l.id === update.layerId);
					if (layerIndex !== -1) {
						Object.assign(project.layers[layerIndex], update.updates);
						persistenceService.markDirty(update.layerId);
					}
				}
				break;
			case 'trait':
				if (update.layerId && update.traitId) {
					const layer = project.layers.find((l) => l.id === update.layerId);
					if (layer) {
						const traitIndex = layer.traits.findIndex((t) => t.id === update.traitId);
						if (traitIndex !== -1) {
							Object.assign(layer.traits[traitIndex], update.updates);
							persistenceService.markDirty(update.layerId);
						}
					}
				}
				break;
		}
	}

	// Persist once for all updates
	persistenceService.saveProject(project);
}

function scheduleBatchPersist(): void {
	if (batchTimeout) {
		clearTimeout(batchTimeout);
	}

	const delay = calculateAdaptiveDelay(batchQueue.length);

	batchTimeout = setTimeout(() => {
		processBatchQueue();
		batchTimeout = null;
	}, delay);
}

export function updateTraitsBatch(
	updates: Array<{
		layerId: LayerId;
		traitId: TraitId;
		updates: Partial<Trait>;
	}>
): void {
	for (const update of updates) {
		batchQueue.push({
			layerId: update.layerId,
			traitId: update.traitId,
			updates: update.updates,
			type: 'trait'
		});
	}
	scheduleBatchPersist();
}

export function updateLayersBatch(
	updates: Array<{
		layerId: LayerId;
		updates: Partial<Layer>;
	}>
): void {
	for (const update of updates) {
		batchQueue.push({
			layerId: update.layerId,
			updates: update.updates,
			type: 'layer'
		});
	}
	scheduleBatchPersist();
}

export function addTraitsBatch(layerId: LayerId, traits: Trait[]): void {
	const layerIndex = project.layers.findIndex((l) => l.id === layerId);
	if (layerIndex !== -1) {
		project.layers[layerIndex].traits.push(...traits);

		traits.forEach((trait) => {
			if (trait.imageUrl) {
				globalResourceManager.addObjectUrl(trait.imageUrl);
			}
		});
	}
	scheduleBatchPersist();
}

export function flushBatch(): void {
	if (batchQueue.length > 0) {
		processBatchQueue();
	}
	if (batchTimeout) {
		clearTimeout(batchTimeout);
		batchTimeout = null;
	}
}

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

// Project management functions
export function updateProjectName(name: string): void {
	validationService.validateProjectName(name);
	project.name = name;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectDescription(description: string): void {
	project.description = description;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectMetadataStandard(standard: MetadataStandard): void {
	project.metadataStandard = standard;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectSymbol(symbol: string): void {
	project.symbol = symbol;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectSellerFee(fee: number): void {
	project.sellerFeeBasisPoints = fee;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectExternalUrl(url: string): void {
	project.externalUrl = url;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectAnimationUrl(url: string): void {
	project.animationUrl = url;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectCreators(creators: { address: string; share: number }[]): void {
	project.creators = creators;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateProjectDimensions(dimensions: ProjectDimensions): void {
	validationService.validateDimensions(dimensions);
	project.outputSize = dimensions;
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

// Layer management functions
export function addLayer(name: string): void {
	validationService.validateLayerName(name);

	const newLayer: Layer = {
		id: createLayerId(crypto.randomUUID()),
		name,
		order: project.layers.length,
		traits: []
	};

	project.layers.push(newLayer);
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function removeLayer(layerId: LayerId): void {
	const layerIndex = project.layers.findIndex((layer: Layer) => layer.id === layerId);
	if (layerIndex === -1) return;

	const layer = project.layers[layerIndex];
	layer.traits.forEach((trait: Trait) => {
		if (trait.imageUrl) {
			const urlToRevoke = trait.imageUrl;
			trait.imageUrl = undefined;
			globalResourceManager.removeObjectUrl(urlToRevoke);
		}
	});

	project.layers.splice(layerIndex, 1);
	project.layers.forEach((layer: Layer, index: number) => {
		layer.order = index;
	});

	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

export function updateLayerName(layerId: LayerId, name: string): void {
	validationService.validateLayerName(name);
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;
	layer.name = name;
	persistenceService.markDirty(layerId);
	persistenceService.schedulePersist(project);
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
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}

// Batch loading state for traits
const pendingTraitUpdates = new SvelteMap<string, { trait: Trait; layer: Layer; file: File }>();
const pendingTraitPromises = new SvelteMap<
	TraitId,
	{ resolve: () => void; reject: (error: Error) => void }
>();

async function processPendingTraitUpdates(): Promise<void> {
	if (pendingTraitUpdates.size === 0) return;

	const updates = Array.from(pendingTraitUpdates.values());
	pendingTraitUpdates.clear();

	const results = await Promise.all(
		updates.map(async ({ trait, layer, file }) => {
			try {
				const arrayBuffer = await fileToArrayBuffer(file);
				trait.imageData = arrayBuffer;
				const blob = new Blob([arrayBuffer], {
					type: file.type || 'image/png'
				});
				trait.imageUrl = URL.createObjectURL(blob);
				globalResourceManager.addObjectUrl(trait.imageUrl);
				pendingTraitPromises.get(trait.id)?.resolve();
				pendingTraitPromises.delete(trait.id);
				return { trait, layer };
			} catch (error) {
				const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
				if (traitIndex !== -1) layer.traits.splice(traitIndex, 1);
				pendingTraitPromises.get(trait.id)?.reject(error as Error);
				pendingTraitPromises.delete(trait.id);
				return null;
			}
		})
	);

	const validResults = results.filter((r): r is { trait: Trait; layer: Layer } => r !== null);
	for (const { trait, layer } of validResults) {
		const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
		if (traitIndex !== -1) layer.traits[traitIndex] = trait;
	}
}

let batchTimeoutId: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 100;

function scheduleBatchUpdate() {
	if (batchTimeoutId) clearTimeout(batchTimeoutId);
	batchTimeoutId = setTimeout(() => {
		processPendingTraitUpdates();
		batchTimeoutId = null;
	}, BATCH_DELAY_MS);
}

// Trait management functions
export function addTrait(layerId: LayerId, file: File): Promise<void> {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) throw new Error(`Layer with ID ${layerId} not found`);

	const traitName = file.name.replace(/\.[^/.]+$/, '');
	validationService.validateTraitName(traitName);

	const newTrait: Trait = {
		id: createTraitId(crypto.randomUUID()),
		name: traitName,
		imageData: new ArrayBuffer(0),
		rarityWeight: 5
	};

	layer.traits.push(newTrait);
	const loadPromise = new Promise<void>((resolve, reject) => {
		pendingTraitPromises.set(newTrait.id, { resolve, reject });
	});

	pendingTraitUpdates.set(newTrait.id, { trait: newTrait, layer, file });
	scheduleBatchUpdate();
	persistenceService.markDirty(layerId);
	persistenceService.schedulePersist(project);

	return loadPromise;
}

export function removeTrait(layerId: LayerId, traitId: TraitId): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;

	const traitIndex = layer.traits.findIndex((trait: Trait) => trait.id === traitId);
	if (traitIndex === -1) return;

	const trait = layer.traits[traitIndex];
	if (trait.imageUrl) globalResourceManager.removeObjectUrl(trait.imageUrl);

	layer.traits.splice(traitIndex, 1);
	persistenceService.markDirty(layerId);
	persistenceService.schedulePersist(project);
}

export function updateTraitName(layerId: LayerId, traitId: TraitId, name: string): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;
	const trait = layer.traits.find((trait: Trait) => trait.id === traitId);
	if (!trait) return;
	validationService.validateTraitName(name);
	trait.name = name;
	persistenceService.markDirty(layerId);
	persistenceService.schedulePersist(project);
}

export function updateTraitRarity(layerId: LayerId, traitId: TraitId, rarityWeight: number): void {
	const layer = project.layers.find((layer: Layer) => layer.id === layerId);
	if (!layer) return;
	const trait = layer.traits.find((trait: Trait) => trait.id === traitId);
	if (!trait) return;
	validationService.validateRarityWeight(rarityWeight);
	trait.rarityWeight = rarityWeight;
	persistenceService.markDirty(layerId);
	persistenceService.schedulePersist(project);
}

// Loading state delegation
export function startLoading(op: string) {
	loadingStateManager.startLoading(op);
}
export function stopLoading(op: string) {
	loadingStateManager.stopLoading(op);
}
export function getLoadingState(op: string) {
	return loadingStateManager.getLoadingState(op);
}
export function startDetailedLoading(op: string, total = 100) {
	loadingStateManager.startDetailedLoading(op, total);
}
export function updateDetailedLoading(op: string, p: number, m?: string) {
	loadingStateManager.updateDetailedLoading(op, p, m);
}
export function stopDetailedLoading(op: string, s = true) {
	loadingStateManager.stopDetailedLoading(op, s);
}
export function getDetailedLoadingState(op: string) {
	return loadingStateManager.getDetailedLoadingState(op);
}

// Project persistence
export async function saveProjectToZip(): Promise<ArrayBuffer> {
	const timerId = performanceMonitor.startTimer('project.saveProjectToZip');
	startLoading('project-save');
	startDetailedLoading('project-save', 100);
	try {
		const result = await saveProjectToZipImpl(project);
		stopDetailedLoading('project-save');
		stopLoading('project-save');
		performanceMonitor.stopTimer(timerId);
		return result;
	} catch (error) {
		stopDetailedLoading('project-save', false);
		stopLoading('project-save');
		performanceMonitor.stopTimer(timerId, { error: String(error) });
		throw error;
	}
}

export async function loadProjectFromZip(file: File): Promise<void> {
	try {
		startLoading('project-load');
		startDetailedLoading('project-load', 100);
		globalResourceManager.cleanup();
		const loadedProject = await loadProjectFromZipImpl(file);
		project.id = loadedProject.id;
		project.name = loadedProject.name;
		project.description = loadedProject.description || '';
		project.outputSize = loadedProject.outputSize || { width: 0, height: 0 };
		project.layers = loadedProject.layers;
		project._needsProperLoad = false;
		persistenceService.schedulePersist(project);
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

export function cleanupAllResources(): void {
	globalResourceManager.cleanup();
}

export function clearPersistedData(): void {
	persistenceService.clearData();
}

export function hasPersistedData(): boolean {
	return persistenceService.hasData();
}

// Strict Pair management
export function updateStrictPairConfig(projectId: ProjectId, config: StrictPairConfig): void {
	if (project.id !== projectId) throw new Error('Project ID mismatch');
	project.strictPairConfig = { ...config };
	persistenceService.markDirty();
	persistenceService.schedulePersist(project);
}
export function getStrictPairConfig() {
	return project.strictPairConfig ? { ...project.strictPairConfig } : undefined;
}
export function isStrictPairEnabled() {
	return project.strictPairConfig?.enabled ?? false;
}
export function getActiveLayerCombinations(): string[] {
	return (
		project.strictPairConfig?.layerCombinations
			.filter((lc: { active: boolean; id: string }) => lc.active)
			.map((lc: { active: boolean; id: string }) => lc.id) ?? []
	);
}

export function resetProject(): void {
	globalResourceManager.cleanup();
	persistenceService.clearData();
	const newProject = validationService.createDefaultProject();
	Object.assign(project, newProject);
	project.layers = []; // Force clear layers even if default has some
	project._needsProperLoad = true;
}
