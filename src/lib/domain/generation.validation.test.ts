import { describe, expect, it } from 'vite-plus/test';
import { validateGenerationRequest } from './generation.validation';
import { unsafeCreateLayerId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Layer } from '$lib/types/layer';

function layer(overrides: Partial<Layer> = {}): Layer {
	return {
		id: unsafeCreateLayerId('layer-1'),
		name: 'Background',
		order: 0,
		traits: [
			{
				id: unsafeCreateTraitId('trait-1'),
				name: 'Blue',
				imageData: new ArrayBuffer(4),
				rarityWeight: 1
			}
		],
		...overrides
	};
}

describe('validateGenerationRequest', () => {
	it('accepts a valid generation request', () => {
		const result = validateGenerationRequest({
			layers: [layer()],
			outputSize: { width: 100, height: 100 },
			collectionSize: 10
		});

		expect(result.success).toBe(true);
	});

	it('requires at least one layer', () => {
		const result = validateGenerationRequest({
			layers: [],
			outputSize: { width: 100, height: 100 },
			collectionSize: 10
		});

		expect(result).toMatchObject({
			success: false,
			message: 'Project must have at least one layer.'
		});
	});

	it('requires positive output dimensions', () => {
		const result = validateGenerationRequest({
			layers: [layer()],
			outputSize: { width: 0, height: 100 },
			collectionSize: 10
		});

		expect(result).toMatchObject({
			success: false,
			message: 'Project output size not set. Please upload an image first.'
		});
	});

	it('requires traits on every layer', () => {
		const result = validateGenerationRequest({
			layers: [layer({ name: 'Empty', traits: [] })],
			outputSize: { width: 100, height: 100 },
			collectionSize: 10
		});

		expect(result).toMatchObject({
			success: false,
			message: 'The following layers have no traits: Empty'
		});
	});

	it('requires image data for every trait', () => {
		const result = validateGenerationRequest({
			layers: [
				layer({
					traits: [
						{
							id: unsafeCreateTraitId('trait-2'),
							name: 'Missing',
							imageData: new ArrayBuffer(0),
							rarityWeight: 1
						}
					]
				})
			],
			outputSize: { width: 100, height: 100 },
			collectionSize: 10
		});

		expect(result).toMatchObject({
			success: false,
			message: 'Missing image data. Please upload images for all traits.'
		});
	});

	it('requires a valid collection size', () => {
		const result = validateGenerationRequest({
			layers: [layer()],
			outputSize: { width: 100, height: 100 },
			collectionSize: 10001
		});

		expect(result).toMatchObject({
			success: false,
			message: 'Collection size cannot exceed 10000 items.'
		});
	});
});
