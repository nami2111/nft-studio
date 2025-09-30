/**
 * Domain payload abstractions used for worker communication.
 */
import type { Layer } from '$lib/types/layer';
import type { TransferrableLayer, TransferrableTrait } from '$lib/types/worker-messages';

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
				layer.traits.map(async (trait) => {
					// Create a clean ArrayBuffer to ensure it's properly serializable
					const cleanArrayBuffer = new ArrayBuffer(trait.imageData.byteLength);
					const sourceView = new Uint8Array(trait.imageData);
					const destView = new Uint8Array(cleanArrayBuffer);
					destView.set(sourceView);

					// Create a clean trait object with only the properties defined in TransferrableTrait
					const transferrableTrait: TransferrableTrait = {
						id: String(trait.id),
						name: String(trait.name),
						imageData: cleanArrayBuffer,
						rarityWeight: Number(trait.rarityWeight),
						width: trait.width !== undefined ? Number(trait.width) : undefined,
						height: trait.height !== undefined ? Number(trait.height) : undefined
					};

					return transferrableTrait;
				})
			);

			// Create a clean layer object with only the properties defined in TransferrableLayer
			const transferrableLayer: TransferrableLayer = {
				id: String(layer.id),
				name: String(layer.name),
				order: Number(layer.order),
				isOptional: layer.isOptional ? Boolean(layer.isOptional) : undefined,
				traits: transferrableTraits
			};

			return transferrableLayer;
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
