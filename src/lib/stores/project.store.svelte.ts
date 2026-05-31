/**
 * Modern Svelte 5 runes-based project store
 * Thin state holder that delegates mutations to CollectionDesignMutator
 *
 * @note The `project` export is intentionally a module-level singleton.
 * This app is a single-session SPA (no SSR, no multi-user), so a global
 * singleton is appropriate. If multi-instance support is ever needed,
 * migrate to Svelte context (setContext/getContext).
 */

import { calculateAdaptiveDelay } from '$lib/config/performance.config';
import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import {
	updateProjectName as mutateProjectName,
	updateProjectDescription as mutateProjectDescription,
	updateProjectDimensions as mutateProjectDimensions,
	updateProjectMetadataStandard as mutateProjectMetadataStandard,
	updateProjectSymbol as mutateProjectSymbol,
	updateProjectSellerFee as mutateProjectSellerFee,
	updateProjectExternalUrl as mutateProjectExternalUrl,
	updateProjectAnimationUrl as mutateProjectAnimationUrl,
	updateProjectCreators as mutateProjectCreators,
	updateProjectPartial as mutateProjectPartial,
	addLayer as mutateAddLayer,
	removeLayer as mutateRemoveLayer,
	updateLayerName as mutateLayerName,
	updateLayer as mutateLayer,
	reorderLayers as mutateReorderLayers,
	removeTrait as mutateRemoveTrait,
	updateTraitName as mutateTraitName,
	updateTraitRarity as mutateTraitRarity,
	updateTrait as mutateTrait,
	toggleTraitType as mutateToggleTraitType,
	updateTraitRulerRules as mutateTraitRulerRules,
	updateTraitsBatch as mutateTraitsBatch,
	updateLayersBatch as mutateLayersBatch,
	addTraitsBatch as mutateAddTraitsBatch,
	updateStrictPairConfig as mutateStrictPairConfig,
	replaceProject as mutateReplaceProject,
	resetProject as mutateResetProject,
	type MutationResult,
	type TraitBatchUpdate,
	type LayerBatchUpdate
} from '$lib/domain/collection-design-mutator';
import type { LayerId, ProjectId, TraitId } from '$lib/types/ids';
import type { RulerRule, StrictPairConfig, TraitType } from '$lib/types/layer';
import type { Layer, Project, ProjectDimensions, Trait } from '$lib/types/project';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { persistenceService } from '../services/persistence.service';
import { validationService } from '../services/validation.service';
import {
	loadProjectFromZip as loadProjectFromZipImpl,
	saveProjectToZip as saveProjectToZipImpl
} from './file-operations';
import {
	startLoading,
	stopLoading,
	getLoadingState,
	startDetailedLoading,
	updateDetailedLoading,
	stopDetailedLoading,
	getDetailedLoadingState
} from './loading-state.svelte';
import { globalResourceManager } from './resource-manager';
import { traitUploadManager } from './trait-upload-manager';

// Initialize project with a fresh default project.
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

// Persistence helper — schedules save when a mutation changed something.
// Persistence service detects what changed internally via snapshot comparison.
function handleMutationResult(result: MutationResult): void {
	if (!result.changed) return;
	persistenceService.save(project);
}

// Project metadata mutations

export function updateProject(updates: Partial<Project>): void {
	const result = mutateProjectPartial(project, updates);
	handleMutationResult(result);
}

export function updateProjectName(name: string): void {
	validationService.validateProjectName(name);
	const result = mutateProjectName(project, name);
	handleMutationResult(result);
}

export function updateProjectDescription(description: string): void {
	const result = mutateProjectDescription(project, description);
	handleMutationResult(result);
}

export function updateProjectMetadataStandard(standard: MetadataStandard): void {
	const result = mutateProjectMetadataStandard(project, standard);
	handleMutationResult(result);
}

export function updateProjectSymbol(symbol: string): void {
	const result = mutateProjectSymbol(project, symbol);
	handleMutationResult(result);
}

export function updateProjectSellerFee(fee: number): void {
	const result = mutateProjectSellerFee(project, fee);
	handleMutationResult(result);
}

export function updateProjectExternalUrl(url: string): void {
	const result = mutateProjectExternalUrl(project, url);
	handleMutationResult(result);
}

export function updateProjectAnimationUrl(url: string): void {
	const result = mutateProjectAnimationUrl(project, url);
	handleMutationResult(result);
}

export function updateProjectCreators(creators: { address: string; share: number }[]): void {
	const result = mutateProjectCreators(project, creators);
	handleMutationResult(result);
}

export function updateProjectDimensions(dimensions: ProjectDimensions): void {
	validationService.validateDimensions(dimensions);
	const result = mutateProjectDimensions(project, dimensions);
	handleMutationResult(result);
}

// Layer mutations

export function updateLayer(layerId: LayerId, updates: Partial<Layer>): void {
	const result = mutateLayer(project, layerId, updates);
	handleMutationResult(result);
}

export function addLayer(name: string): void {
	validationService.validateLayerName(name);
	const result = mutateAddLayer(project, name);
	handleMutationResult(result);
}

export function removeLayer(layerId: LayerId): void {
	const layer = project.layers.find((l) => l.id === layerId);
	if (layer) {
		for (const trait of layer.traits) {
			if (trait.imageUrl) {
				globalResourceManager.removeObjectUrl(trait.imageUrl);
			}
		}
	}

	const result = mutateRemoveLayer(project, layerId);
	handleMutationResult(result);
}

export function updateLayerName(layerId: LayerId, name: string): void {
	validationService.validateLayerName(name);
	const result = mutateLayerName(project, layerId, name);
	handleMutationResult(result);
}

export function reorderLayers(layerIds: LayerId[]): void {
	const result = mutateReorderLayers(project, layerIds);
	handleMutationResult(result);
}

// Trait mutations

export function updateTrait(layerId: LayerId, traitId: TraitId, updates: Partial<Trait>): void {
	const result = mutateTrait(project, layerId, traitId, updates);
	handleMutationResult(result);
}

export async function addTrait(layerId: LayerId, file: File): Promise<void> {
	const layer = project.layers.find((l) => l.id === layerId);
	if (!layer) throw new Error(`Layer with ID ${layerId} not found`);

	const traitName = file.name.replace(/\.[^/.]+$/, '');
	validationService.validateTraitName(traitName);

	await traitUploadManager.uploadTrait(layerId, layer, file, traitName);
	persistenceService.save(project);
}

export function removeTrait(layerId: LayerId, traitId: TraitId): void {
	const layer = project.layers.find((l) => l.id === layerId);
	if (!layer) return;

	const trait = layer.traits.find((t) => t.id === traitId);
	if (trait?.imageUrl) {
		globalResourceManager.removeObjectUrl(trait.imageUrl);
	}

	const result = mutateRemoveTrait(project, layerId, traitId);
	handleMutationResult(result);
}

export function updateTraitName(layerId: LayerId, traitId: TraitId, name: string): void {
	validationService.validateTraitName(name);
	const result = mutateTraitName(project, layerId, traitId, name);
	handleMutationResult(result);
}

export function updateTraitRarity(layerId: LayerId, traitId: TraitId, rarityWeight: number): void {
	validationService.validateRarityWeight(rarityWeight);
	const result = mutateTraitRarity(project, layerId, traitId, rarityWeight);
	handleMutationResult(result);
}

export function toggleTraitType(layerId: LayerId, traitId: TraitId): TraitType | undefined {
	const result = mutateToggleTraitType(project, layerId, traitId);
	handleMutationResult(result);
	return result.type;
}

export function updateTraitRulerRules(
	layerId: LayerId,
	traitId: TraitId,
	rules: RulerRule[]
): void {
	const result = mutateTraitRulerRules(project, layerId, traitId, rules);
	handleMutationResult(result);
}

// Batch mutations

interface BatchQueueItem {
	type: 'trait' | 'layer';
	layerId: LayerId;
	traitId?: TraitId;
	updates: Partial<Trait> | Partial<Layer>;
}

let batchQueue: BatchQueueItem[] = [];
let batchTimeout: ReturnType<typeof setTimeout> | null = null;

function processBatchQueue(): void {
	if (batchQueue.length === 0) return;

	const traitUpdates: TraitBatchUpdate[] = [];
	const layerUpdates: LayerBatchUpdate[] = [];

	for (const item of batchQueue) {
		if (item.type === 'trait' && item.traitId) {
			traitUpdates.push({
				layerId: item.layerId,
				traitId: item.traitId,
				updates: item.updates as Partial<Trait>
			});
		} else if (item.type === 'layer') {
			layerUpdates.push({
				layerId: item.layerId,
				updates: item.updates as Partial<Layer>
			});
		}
	}
	batchQueue = [];

	if (traitUpdates.length > 0) {
		const result = mutateTraitsBatch(project, traitUpdates);
		handleMutationResult(result);
	}

	if (layerUpdates.length > 0) {
		const result = mutateLayersBatch(project, layerUpdates);
		handleMutationResult(result);
	}

	persistenceService.save(project);
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
	updates: Array<{ layerId: LayerId; traitId: TraitId; updates: Partial<Trait> }>
): void {
	for (const update of updates) {
		batchQueue.push({
			type: 'trait',
			layerId: update.layerId,
			traitId: update.traitId,
			updates: update.updates
		});
	}
	scheduleBatchPersist();
}

export function updateLayersBatch(
	updates: Array<{ layerId: LayerId; updates: Partial<Layer> }>
): void {
	for (const update of updates) {
		batchQueue.push({
			type: 'layer',
			layerId: update.layerId,
			updates: update.updates
		});
	}
	scheduleBatchPersist();
}

export function addTraitsBatch(layerId: LayerId, traits: Trait[]): void {
	const result = mutateAddTraitsBatch(project, layerId, traits);

	for (const trait of traits) {
		if (trait.imageUrl) {
			globalResourceManager.addObjectUrl(trait.imageUrl);
		}
	}

	handleMutationResult(result);
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

// Trait upload status API

export function getTraitUploadStatus(traitId: TraitId) {
	return traitUploadManager.getUploadStatus(traitId);
}

export function getPendingUploadCount(): number {
	return traitUploadManager.pendingCount();
}

// Derived state functions

export function isProjectValid(): boolean {
	return (
		project.name.length > 0 &&
		project.outputSize.width > 0 &&
		project.outputSize.height > 0 &&
		project.layers.every((layer) => layer.traits.length > 0)
	);
}

export function totalTraitCount(): number {
	return project.layers.reduce((sum, layer) => sum + layer.traits.length, 0);
}

export function projectNeedsZipLoad(): boolean {
	return project._needsProperLoad ?? true;
}

// Loading state delegation
export {
	startLoading,
	stopLoading,
	getLoadingState,
	startDetailedLoading,
	updateDetailedLoading,
	stopDetailedLoading,
	getDetailedLoadingState
};

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
		mutateReplaceProject(project, loadedProject);
		persistenceService.save(project);
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
	const result = mutateStrictPairConfig(project, projectId, config);
	handleMutationResult(result);
}

export function getStrictPairConfig() {
	return project.strictPairConfig ? { ...project.strictPairConfig } : undefined;
}

export function isStrictPairEnabled() {
	return project.strictPairConfig?.enabled ?? false;
}

export function getActiveLayerCombinations(): string[] {
	return (
		project.strictPairConfig?.layerCombinations.filter((lc) => lc.active).map((lc) => lc.id) ?? []
	);
}

export function resetProject(): void {
	globalResourceManager.cleanup();
	persistenceService.clearData();
	const defaultProject = validationService.createDefaultProject();
	mutateResetProject(project, defaultProject);
}
