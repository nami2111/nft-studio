/**
 * Store Context Helpers
 * Provides Svelte context-based access to store facades.
 */

import { getContext, setContext, hasContext } from 'svelte';
import { createProjectFacade, type ProjectStoreFacade } from './project.facade';
import { createGalleryFacade, type GalleryStoreFacade } from './gallery.facade';
import { createGenerationFacade, type GenerationStoreFacade } from './generation.facade';

const PROJECT_STORE_KEY = Symbol('project-store');
const GALLERY_STORE_KEY = Symbol('gallery-store');
const GENERATION_STORE_KEY = Symbol('generation-store');

// Setters (called in root layout)

export function setProjectStoreContext(facade: ProjectStoreFacade): void {
	setContext(PROJECT_STORE_KEY, facade);
}

export function setGalleryStoreContext(facade: GalleryStoreFacade): void {
	setContext(GALLERY_STORE_KEY, facade);
}

export function setGenerationStoreContext(facade: GenerationStoreFacade): void {
	setContext(GENERATION_STORE_KEY, facade);
}

// Getters (called in components)
// Falls back to creating facade if context not available (e.g., in tests)

export function useProjectStore(): ProjectStoreFacade {
	if (hasContext(PROJECT_STORE_KEY)) {
		return getContext<ProjectStoreFacade>(PROJECT_STORE_KEY);
	}
	return createProjectFacade();
}

export function useGalleryStore(): GalleryStoreFacade {
	if (hasContext(GALLERY_STORE_KEY)) {
		return getContext<GalleryStoreFacade>(GALLERY_STORE_KEY);
	}
	return createGalleryFacade();
}

export function useGenerationStore(): GenerationStoreFacade {
	if (hasContext(GENERATION_STORE_KEY)) {
		return getContext<GenerationStoreFacade>(GENERATION_STORE_KEY);
	}
	return createGenerationFacade();
}
