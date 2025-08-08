import type { Layer } from '$lib/types/layer';
import type { Project } from '$lib/types/project';

// Centralized helper: normalize filenames for safe filesystem
export function normalizeFilename(name: string): string {
	// Remove path separators, trim, limit length, and allow common safe chars
	const trimmed = name.trim().slice(0, 100);
	return trimmed.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/[\/]+/g, '_');
}

// Centralized helper: stable layer sorting by 'order'
export function sortLayers(layers: Layer[]): Layer[] {
	return layers.sort((a, b) => a.order - b.order);
}

// Re-export types for convenience if needed elsewhere
export type { Layer, Project };
