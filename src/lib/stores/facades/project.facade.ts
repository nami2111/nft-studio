/**
 * Project Store Facade
 * Consistent interface for components to access project state and actions.
 * Enables logging, feature flags, and API versioning without changing components.
 */

import type { LayerId, ProjectId, TraitId } from '$lib/types/ids';
import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import type { RulerRule, StrictPairConfig, TraitType } from '$lib/types/layer';
import type { Layer, Project, ProjectDimensions, Trait } from '$lib/types/project';
import {
	project,
	updateProject,
	updateProjectName,
	updateProjectDescription,
	updateProjectMetadataStandard,
	updateProjectSymbol,
	updateProjectSellerFee,
	updateProjectExternalUrl,
	updateProjectAnimationUrl,
	updateProjectCreators,
	updateProjectDimensions,
	updateLayer,
	addLayer,
	removeLayer,
	updateLayerName,
	reorderLayers,
	updateTrait,
	addTrait,
	removeTrait,
	updateTraitName,
	updateTraitRarity,
	toggleTraitType,
	updateTraitRulerRules,
	updateTraitsBatch,
	updateLayersBatch,
	addTraitsBatch,
	flushBatch,
	isProjectValid,
	totalTraitCount,
	projectNeedsZipLoad,
	saveProjectToZip,
	loadProjectFromZip,
	markProjectAsLoaded,
	cleanupAllResources,
	clearPersistedData,
	hasPersistedData,
	updateStrictPairConfig,
	getStrictPairConfig,
	isStrictPairEnabled,
	getActiveLayerCombinations,
	resetProject,
	getTraitUploadStatus,
	getPendingUploadCount
} from '../project.store.svelte';

export interface ProjectStoreFacade {
	state: Project;
	actions: {
		// Project metadata
		updateProject: (updates: Partial<Project>) => void;
		updateProjectName: (name: string) => void;
		updateProjectDescription: (description: string) => void;
		updateProjectMetadataStandard: (standard: MetadataStandard) => void;
		updateProjectSymbol: (symbol: string) => void;
		updateProjectSellerFee: (fee: number) => void;
		updateProjectExternalUrl: (url: string) => void;
		updateProjectAnimationUrl: (url: string) => void;
		updateProjectCreators: (creators: { address: string; share: number }[]) => void;
		updateProjectDimensions: (dimensions: ProjectDimensions) => void;

		// Layer operations
		updateLayer: (layerId: LayerId, updates: Partial<Layer>) => void;
		addLayer: (name: string) => void;
		removeLayer: (layerId: LayerId) => void;
		updateLayerName: (layerId: LayerId, name: string) => void;
		reorderLayers: (layerIds: LayerId[]) => void;

		// Trait operations
		updateTrait: (layerId: LayerId, traitId: TraitId, updates: Partial<Trait>) => void;
		addTrait: (layerId: LayerId, file: File) => Promise<void>;
		removeTrait: (layerId: LayerId, traitId: TraitId) => void;
		updateTraitName: (layerId: LayerId, traitId: TraitId, name: string) => void;
		updateTraitRarity: (layerId: LayerId, traitId: TraitId, rarityWeight: number) => void;
		toggleTraitType: (layerId: LayerId, traitId: TraitId) => TraitType | undefined;
		updateTraitRulerRules: (layerId: LayerId, traitId: TraitId, rules: RulerRule[]) => void;

		// Batch operations
		updateTraitsBatch: (
			updates: Array<{ layerId: LayerId; traitId: TraitId; updates: Partial<Trait> }>
		) => void;
		updateLayersBatch: (updates: Array<{ layerId: LayerId; updates: Partial<Layer> }>) => void;
		addTraitsBatch: (layerId: LayerId, traits: Trait[]) => void;
		flushBatch: () => void;

		// Derived state
		isProjectValid: () => boolean;
		totalTraitCount: () => number;
		projectNeedsZipLoad: () => boolean;

		// Persistence
		saveProjectToZip: () => Promise<ArrayBuffer>;
		loadProjectFromZip: (file: File) => Promise<void>;
		markProjectAsLoaded: () => void;
		cleanupAllResources: () => void;
		clearPersistedData: () => void;
		hasPersistedData: () => boolean;

		// Strict pair config
		updateStrictPairConfig: (projectId: ProjectId, config: StrictPairConfig) => void;
		getStrictPairConfig: () => StrictPairConfig | undefined;
		isStrictPairEnabled: () => boolean;
		getActiveLayerCombinations: () => string[];

		// Upload status
		getTraitUploadStatus: (traitId: TraitId) => 'pending' | 'loaded' | 'failed' | 'unknown';
		getPendingUploadCount: () => number;

		// Reset
		resetProject: () => void;
	};
}

export function createProjectFacade(): ProjectStoreFacade {
	return {
		state: project,
		actions: {
			updateProject,
			updateProjectName,
			updateProjectDescription,
			updateProjectMetadataStandard,
			updateProjectSymbol,
			updateProjectSellerFee,
			updateProjectExternalUrl,
			updateProjectAnimationUrl,
			updateProjectCreators,
			updateProjectDimensions,
			updateLayer,
			addLayer,
			removeLayer,
			updateLayerName,
			reorderLayers,
			updateTrait,
			addTrait,
			removeTrait,
			updateTraitName,
			updateTraitRarity,
			toggleTraitType,
			updateTraitRulerRules,
			updateTraitsBatch,
			updateLayersBatch,
			addTraitsBatch,
			flushBatch,
			isProjectValid,
			totalTraitCount,
			projectNeedsZipLoad,
			saveProjectToZip,
			loadProjectFromZip,
			markProjectAsLoaded,
			cleanupAllResources,
			clearPersistedData,
			hasPersistedData,
			updateStrictPairConfig,
			getStrictPairConfig,
			isStrictPairEnabled,
			getActiveLayerCombinations,
			getTraitUploadStatus,
			getPendingUploadCount,
			resetProject
		}
	};
}
