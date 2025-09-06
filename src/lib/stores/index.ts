// Export the new runes-based store
export {
	project,
	projectStore,
	startLoading,
	stopLoading,
	isLoading,
	updateProjectName,
	updateProjectDescription,
	updateProjectDimensions,
	addLayer,
	removeLayer,
	updateLayerName,
	reorderLayers,
	addTrait,
	removeTrait,
	updateTraitName,
	updateTraitRarity
} from './runes-store';

// Legacy exports for backward compatibility
export * as layersStore from './layers';
export * as traitsStore from './traits';
export * from './store-core';
export * from './loading.store';
