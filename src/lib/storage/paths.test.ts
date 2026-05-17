import { describe, expect, it } from 'vite-plus/test';
import { joinStoragePath, sanitizeStorageSegment, storagePaths } from './paths';

describe('storage paths', () => {
	it('builds stable OPFS paths from IDs', () => {
		expect(storagePaths.projectTraitAsset('layer-1', 'trait-2')).toBe(
			'gnstudio/projects/current/layers/layer-1/trait-2.bin'
		);
		expect(storagePaths.projectRoot()).toBe('gnstudio/projects/current');
		expect(storagePaths.projectLayersRoot()).toBe('gnstudio/projects/current/layers');
		expect(storagePaths.projectLayerRoot('layer-1')).toBe(
			'gnstudio/projects/current/layers/layer-1'
		);
		expect(storagePaths.galleryItemImage('collection-1', 'item-2')).toBe(
			'gnstudio/gallery/collections/collection-1/items/item-2.bin'
		);
		expect(storagePaths.galleryItemLookup('item-2')).toBe(
			'gnstudio/gallery/item-index/item-2.json'
		);
		expect(storagePaths.galleryCollectionsRoot()).toBe('gnstudio/gallery/collections');
		expect(storagePaths.generationRoot()).toBe('gnstudio/generation');
		expect(storagePaths.generationImage('gen-123', 4)).toBe(
			'gnstudio/generation/gen-123/images/4.bin'
		);
	});

	it('joins sanitized path segments', () => {
		expect(joinStoragePath('gnstudio', 'gallery', 'index.json')).toBe(
			'gnstudio/gallery/index.json'
		);
	});

	it('rejects unsafe path segments', () => {
		expect(() => sanitizeStorageSegment('')).toThrow();
		expect(() => sanitizeStorageSegment('..')).toThrow();
		expect(() => sanitizeStorageSegment('../secret')).toThrow();
		expect(() => sanitizeStorageSegment('folder/name')).toThrow();
		expect(() => sanitizeStorageSegment('folder\\name')).toThrow();
		expect(() => sanitizeStorageSegment('display name')).toThrow();
	});
});
