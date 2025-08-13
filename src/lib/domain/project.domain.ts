/**
 * Domain payload abstractions used for worker communication.
 */
import type { Layer } from '$lib/types/layer';
// import type { Trait } from '$lib/types/trait';

export interface TransferrableTrait {
	id: string;
	name: string;
	imageData: ArrayBuffer;
	rarityWeight: number;
	// Add width/height for better memory management
	width?: number;
	height?: number;
}

export interface TransferrableLayer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: TransferrableTrait[];
	// Add layer-level width/height for consistent sizing
	width?: number;
	height?: number;
}

/**
 * Prepare layers for worker with validation.
 * Validates input layers and traits, ensuring at least one trait per layer and valid image data, and converts to a transferable payload for workers.
 */
export async function prepareLayersForWorker(layers: Layer[]): Promise<TransferrableLayer[]> {
	// Validate that all layers have valid image data
	for (const layer of layers) {
		if (layer.traits.length === 0) {
			throw new Error(
				`Layer "${layer.name}" has no traits. Please add at least one trait to each layer.`
			);
		}

		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				throw new Error(
					`Trait "${trait.name}" in layer "${layer.name}" has missing or invalid image data. Please re-upload the images.`
				);
			}
		}
	}

	const transferrableLayers = await Promise.all(
		layers.map(async (layer) => {
			const transferrableTraits = await Promise.all(
				layer.traits.map(async (trait) => ({
					id: trait.id,
					name: trait.name,
					imageData: trait.imageData,
					rarityWeight: trait.rarityWeight,
					// Include width/height for better memory management
					width: trait.width,
					height: trait.height
				}))
			);
			return {
				id: layer.id,
				name: layer.name,
				order: layer.order,
				isOptional: layer.isOptional,
				traits: transferrableTraits
				// Note: Layer doesn't have width/height properties in the base type
			};
		})
	);
	return transferrableLayers;
}

// Additional helpers for validation used by UI feedback
export function hasMissingImageData(layers: Layer[]): boolean {
	for (const layer of layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				return true;
			}
		}
	}
	return false;
}

export function getLayersWithMissingImages(
	layers: Layer[]
): Array<{ layerName: string; traitName: string }> {
	const missingImages: Array<{ layerName: string; traitName: string }> = [];
	for (const layer of layers) {
		for (const trait of layer.traits) {
			if (!trait.imageData || trait.imageData.byteLength === 0) {
				missingImages.push({ layerName: layer.name, traitName: trait.name });
			}
		}
	}
	return missingImages;
}
