/**
 * CollectionDesignMutator — pure mutation functions for Collection Design.
 *
 * All functions mutate the project in place and return a result indicating
 * what changed. The store layer handles persistence based on dirty flags.
 *
 * @note Functions do NOT handle persistence, object URLs, or loading state.
 * Those concerns belong to the store/service layer.
 */

import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import type { LayerId, ProjectId, TraitId } from '$lib/types/ids';
import { createLayerId, createTraitId } from '$lib/types/ids';
import type { Layer, RulerRule, StrictPairConfig, Trait, TraitType } from '$lib/types/layer';
import type { Project, ProjectDimensions } from '$lib/types/project';

// Result types

export interface MutationResult {
	changed: boolean;
	dirtyLayers: Set<LayerId>;
	dirtyMetadata: boolean;
}

export interface TraitMutationResult extends MutationResult {
	trait?: Trait;
}

export interface LayerMutationResult extends MutationResult {
	layer?: Layer;
}

export interface TraitTypeMutationResult extends MutationResult {
	type?: TraitType;
}

function emptyResult(): MutationResult {
	return { changed: false, dirtyLayers: new Set(), dirtyMetadata: false };
}

function metadataChanged(): MutationResult {
	return { changed: true, dirtyLayers: new Set(), dirtyMetadata: true };
}

function layerChanged(layerId: LayerId): MutationResult {
	return { changed: true, dirtyLayers: new Set([layerId]), dirtyMetadata: false };
}

function layersChanged(layerIds: LayerId[]): MutationResult {
	return { changed: true, dirtyLayers: new Set(layerIds), dirtyMetadata: false };
}

// Helpers

function findLayer(project: Project, layerId: LayerId): Layer | undefined {
	return project.layers.find((l) => l.id === layerId);
}

function findLayerIndex(project: Project, layerId: LayerId): number {
	return project.layers.findIndex((l) => l.id === layerId);
}

function findTrait(project: Project, layerId: LayerId, traitId: TraitId): Trait | undefined {
	const layer = findLayer(project, layerId);
	return layer?.traits.find((t) => t.id === traitId);
}

function findTraitIndex(layer: Layer, traitId: TraitId): number {
	return layer.traits.findIndex((t) => t.id === traitId);
}

function cloneRulerRules(rules: RulerRule[]): RulerRule[] {
	return rules.map((rule) => {
		const allowedTraitIds = [...new Set(rule.allowedTraitIds)];
		const forbiddenTraitIds = [...new Set(rule.forbiddenTraitIds)].filter(
			(id) => !allowedTraitIds.includes(id)
		);
		return { layerId: rule.layerId, allowedTraitIds, forbiddenTraitIds };
	});
}

function rulerRulesEqual(left: RulerRule[] | undefined, right: RulerRule[]): boolean {
	const normalizedLeft = cloneRulerRules(left ?? []);
	const normalizedRight = cloneRulerRules(right);
	return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

// Project metadata mutations

export function updateProjectName(project: Project, name: string): MutationResult {
	if (project.name === name) return emptyResult();
	project.name = name;
	return metadataChanged();
}

export function updateProjectDescription(project: Project, description: string): MutationResult {
	if (project.description === description) return emptyResult();
	project.description = description;
	return metadataChanged();
}

export function updateProjectDimensions(
	project: Project,
	dimensions: ProjectDimensions
): MutationResult {
	if (
		project.outputSize.width === dimensions.width &&
		project.outputSize.height === dimensions.height
	) {
		return emptyResult();
	}
	project.outputSize = dimensions;
	return metadataChanged();
}

export function updateProjectMetadataStandard(
	project: Project,
	standard: MetadataStandard
): MutationResult {
	if (project.metadataStandard === standard) return emptyResult();
	project.metadataStandard = standard;
	return metadataChanged();
}

export function updateProjectSymbol(project: Project, symbol: string): MutationResult {
	if (project.symbol === symbol) return emptyResult();
	project.symbol = symbol;
	return metadataChanged();
}

export function updateProjectSellerFee(project: Project, fee: number): MutationResult {
	if (project.sellerFeeBasisPoints === fee) return emptyResult();
	project.sellerFeeBasisPoints = fee;
	return metadataChanged();
}

export function updateProjectExternalUrl(project: Project, url: string): MutationResult {
	if (project.externalUrl === url) return emptyResult();
	project.externalUrl = url;
	return metadataChanged();
}

export function updateProjectAnimationUrl(project: Project, url: string): MutationResult {
	if (project.animationUrl === url) return emptyResult();
	project.animationUrl = url;
	return metadataChanged();
}

export function updateProjectCreators(
	project: Project,
	creators: { address: string; share: number }[]
): MutationResult {
	project.creators = creators;
	return metadataChanged();
}

// Layer mutations

export function addLayer(project: Project, name: string): LayerMutationResult {
	const newLayer: Layer = {
		id: createLayerId(crypto.randomUUID()),
		name,
		order: project.layers.length,
		traits: []
	};
	project.layers.push(newLayer);
	return { ...metadataChanged(), layer: newLayer };
}

export function removeLayer(project: Project, layerId: LayerId): MutationResult {
	const index = findLayerIndex(project, layerId);
	if (index === -1) return emptyResult();

	project.layers.splice(index, 1);
	project.layers.forEach((layer, i) => {
		layer.order = i;
	});

	return metadataChanged();
}

export function updateLayerName(project: Project, layerId: LayerId, name: string): MutationResult {
	const layer = findLayer(project, layerId);
	if (!layer || layer.name === name) return emptyResult();

	layer.name = name;
	return layerChanged(layerId);
}

export function reorderLayers(project: Project, layerIds: LayerId[]): MutationResult {
	const newLayers: Layer[] = [];
	for (let i = 0; i < layerIds.length; i++) {
		const layer = findLayer(project, layerIds[i]);
		if (layer) {
			layer.order = i;
			newLayers.push(layer);
		}
	}
	project.layers = newLayers;
	return metadataChanged();
}

export function updateLayer(
	project: Project,
	layerId: LayerId,
	updates: Partial<Layer>
): MutationResult {
	const index = findLayerIndex(project, layerId);
	if (index === -1) return emptyResult();

	Object.assign(project.layers[index], updates);
	return layerChanged(layerId);
}

// Trait mutations

export function addTrait(
	project: Project,
	layerId: LayerId,
	traitData: { name: string; imageData: ArrayBuffer; rarityWeight?: number }
): TraitMutationResult {
	const layer = findLayer(project, layerId);
	if (!layer) return { ...emptyResult(), trait: undefined };

	const newTrait: Trait = {
		id: createTraitId(crypto.randomUUID()),
		name: traitData.name,
		imageData: traitData.imageData,
		rarityWeight: traitData.rarityWeight ?? 5
	};

	layer.traits.push(newTrait);
	return { ...layerChanged(layerId), trait: newTrait };
}

export function removeTrait(
	project: Project,
	layerId: LayerId,
	traitId: TraitId
): TraitMutationResult {
	const layer = findLayer(project, layerId);
	if (!layer) return { ...emptyResult(), trait: undefined };

	const index = findTraitIndex(layer, traitId);
	if (index === -1) return { ...emptyResult(), trait: undefined };

	const [removed] = layer.traits.splice(index, 1);
	return { ...layerChanged(layerId), trait: removed };
}

export function updateTraitName(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	name: string
): MutationResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait || trait.name === name) return emptyResult();

	trait.name = name;
	return layerChanged(layerId);
}

export function updateTraitRarity(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	rarityWeight: number
): MutationResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait || trait.rarityWeight === rarityWeight) return emptyResult();

	trait.rarityWeight = rarityWeight;
	return layerChanged(layerId);
}

export function updateTrait(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	updates: Partial<Trait>
): MutationResult {
	const layer = findLayer(project, layerId);
	if (!layer) return emptyResult();

	const index = findTraitIndex(layer, traitId);
	if (index === -1) return emptyResult();

	Object.assign(layer.traits[index], updates);
	return layerChanged(layerId);
}

// Ruler trait mutations

export function setTraitType(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	type: TraitType
): TraitTypeMutationResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return { ...emptyResult(), type: undefined };

	const currentType = trait.type ?? 'normal';
	const alreadyApplied =
		currentType === type &&
		((type === 'ruler' && trait.rulerRules !== undefined) ||
			(type === 'normal' && trait.rulerRules === undefined));

	if (alreadyApplied) {
		return { ...emptyResult(), type };
	}

	trait.type = type;
	trait.rulerRules = type === 'ruler' ? cloneRulerRules(trait.rulerRules ?? []) : undefined;

	return { ...layerChanged(layerId), type };
}

export function toggleTraitType(
	project: Project,
	layerId: LayerId,
	traitId: TraitId
): TraitTypeMutationResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return { ...emptyResult(), type: undefined };

	const currentType = trait.type ?? 'normal';
	const nextType: TraitType = currentType === 'normal' ? 'ruler' : 'normal';
	return setTraitType(project, layerId, traitId, nextType);
}

export function updateTraitRulerRules(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	rules: RulerRule[]
): MutationResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return emptyResult();

	const nextRules = cloneRulerRules(rules);
	const typeChanged = trait.type !== 'ruler';

	if (trait.type !== 'ruler') {
		trait.type = 'ruler';
	}

	if (rulerRulesEqual(trait.rulerRules, nextRules)) {
		return typeChanged ? layerChanged(layerId) : emptyResult();
	}

	trait.rulerRules = nextRules;
	return layerChanged(layerId);
}

// Batch mutations

export interface TraitBatchUpdate {
	layerId: LayerId;
	traitId: TraitId;
	updates: Partial<Trait>;
}

export interface LayerBatchUpdate {
	layerId: LayerId;
	updates: Partial<Layer>;
}

export function updateTraitsBatch(project: Project, updates: TraitBatchUpdate[]): MutationResult {
	const dirtyLayers = new Set<LayerId>();

	for (const { layerId, traitId, updates: traitUpdates } of updates) {
		const layer = findLayer(project, layerId);
		if (!layer) continue;

		const index = findTraitIndex(layer, traitId);
		if (index === -1) continue;

		Object.assign(layer.traits[index], traitUpdates);
		dirtyLayers.add(layerId);
	}

	if (dirtyLayers.size === 0) return emptyResult();
	return { changed: true, dirtyLayers, dirtyMetadata: false };
}

export function updateLayersBatch(project: Project, updates: LayerBatchUpdate[]): MutationResult {
	const dirtyLayers = new Set<LayerId>();

	for (const { layerId, updates: layerUpdates } of updates) {
		const index = findLayerIndex(project, layerId);
		if (index === -1) continue;

		Object.assign(project.layers[index], layerUpdates);
		dirtyLayers.add(layerId);
	}

	if (dirtyLayers.size === 0) return emptyResult();
	return { changed: true, dirtyLayers, dirtyMetadata: false };
}

export function addTraitsBatch(
	project: Project,
	layerId: LayerId,
	traits: Trait[]
): MutationResult {
	const layer = findLayer(project, layerId);
	if (!layer || traits.length === 0) return emptyResult();

	layer.traits.push(...traits);
	return layerChanged(layerId);
}

// Strict Pair mutations

export function updateStrictPairConfig(
	project: Project,
	projectId: ProjectId,
	config: StrictPairConfig
): MutationResult {
	if (project.id !== projectId) {
		throw new Error('Project ID mismatch');
	}
	project.strictPairConfig = { ...config };
	return metadataChanged();
}

// Project-level mutations

export function updateProjectPartial(project: Project, updates: Partial<Project>): MutationResult {
	Object.assign(project, updates);
	return metadataChanged();
}

export function replaceProject(target: Project, source: Project): MutationResult {
	target.id = source.id;
	target.name = source.name;
	target.description = source.description || '';
	target.outputSize = source.outputSize || { width: 0, height: 0 };
	target.layers = source.layers;
	target.metadataStandard = source.metadataStandard;
	target.symbol = source.symbol;
	target.sellerFeeBasisPoints = source.sellerFeeBasisPoints;
	target.externalUrl = source.externalUrl;
	target.animationUrl = source.animationUrl;
	target.creators = source.creators;
	target.strictPairConfig = source.strictPairConfig;
	target._needsProperLoad = false;

	const allLayerIds = target.layers.map((l) => l.id);
	return layersChanged(allLayerIds);
}

export function resetProject(project: Project, defaultProject: Project): MutationResult {
	Object.assign(project, defaultProject);
	project.layers = [];
	project._needsProperLoad = true;
	return metadataChanged();
}
