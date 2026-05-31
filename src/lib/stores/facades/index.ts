/**
 * Store Facades
 * Consistent interface layer between components and stores.
 */

export { createProjectFacade, type ProjectStoreFacade } from './project.facade';
export { createGalleryFacade, type GalleryStoreFacade } from './gallery.facade';
export { createGenerationFacade, type GenerationStoreFacade } from './generation.facade';
export { createLoadingFacade, type LoadingStateFacade } from './loading.facade';
export {
	useProjectStore,
	useGalleryStore,
	useGenerationStore,
	setProjectStoreContext,
	setGalleryStoreContext,
	setGenerationStoreContext
} from './context';
