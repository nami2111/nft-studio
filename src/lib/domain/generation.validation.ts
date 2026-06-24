import type { Layer } from '$lib/types/layer';

export interface GenerationValidationRequest {
	layers: Layer[];
	outputSize: { width: number; height: number };
	collectionSize: number;
}

export type GenerationValidationResult =
	| { success: true }
	| { success: false; message: string; description: string };

const VALIDATION_DESCRIPTION = 'Validation Error';
const MAX_COLLECTION_SIZE = 10000;

function fail(message: string): GenerationValidationResult {
	return {
		success: false,
		message,
		description: VALIDATION_DESCRIPTION
	};
}

/**
 * Validate user-facing generation inputs before worker preparation.
 * Keeps UI validation messages in one place while worker prep remains defensive.
 */
export function validateGenerationRequest(
	request: GenerationValidationRequest
): GenerationValidationResult {
	const { layers, outputSize, collectionSize } = request;

	if (layers.length === 0) {
		return fail('Project must have at least one layer.');
	}

	if (outputSize.width <= 0 || outputSize.height <= 0) {
		return fail('Project output size not set. Please upload an image first.');
	}

	if (!Number.isFinite(collectionSize) || !Number.isInteger(collectionSize) || collectionSize < 1) {
		return fail('Collection size must be a whole number greater than 0.');
	}

	if (collectionSize > MAX_COLLECTION_SIZE) {
		return fail(`Collection size cannot exceed ${MAX_COLLECTION_SIZE} items.`);
	}

	const emptyLayers = layers.filter((layer) => layer.traits.length === 0);
	if (emptyLayers.length > 0) {
		return fail(
			`The following layers have no traits: ${emptyLayers.map((layer) => layer.name).join(', ')}`
		);
	}

	const missingImages = layers.flatMap((layer) =>
		layer.traits.filter((trait) => !trait.imageData || trait.imageData.byteLength === 0)
	);
	if (missingImages.length > 0) {
		return fail('Missing image data. Please upload images for all traits.');
	}

	return { success: true };
}
