import { describe, it, expect, beforeEach, vi } from 'vitest';
import { galleryStore } from './gallery.store.svelte';
import type { GalleryItem } from '$lib/types/gallery';
import * as galleryStorage from '$lib/utils/gallery-storage';

vi.mock('$lib/utils/gallery-storage');

describe('gallery.store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		galleryStore.clearGallery();
	});

	describe('importCollection', () => {
		it('imports collection with items', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [{ layer: 'Background', trait: 'Blue', rarity: 5 }] },
					index: 0
				},
				{
					name: 'Item 2',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [{ layer: 'Background', trait: 'Red', rarity: 5 }] },
					index: 1
				}
			];

			const collection = galleryStore.importCollection(
				items,
				'Test Collection',
				'Test Description'
			);

			expect(collection.name).toBe('Test Collection');
			expect(collection.description).toBe('Test Description');
			expect(collection.items).toHaveLength(2);
			expect(collection.totalSupply).toBe(2);
			expect(galleryStore.collections).toHaveLength(1);
		});

		it('handles duplicate collection names', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			galleryStore.importCollection(items, 'Test', 'First');
			const second = galleryStore.importCollection(items, 'Test', 'Second');

			expect(second.name).toBe('Test (1)');
			expect(galleryStore.collections).toHaveLength(2);
		});

		it('calculates rarity for imported items', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [{ layer: 'Background', trait: 'Blue', rarity: 5 }] },
					index: 0
				},
				{
					name: 'Item 2',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [{ layer: 'Background', trait: 'Blue', rarity: 5 }] },
					index: 1
				}
			];

			const collection = galleryStore.importCollection(items, 'Test', 'Test');

			expect(collection.items[0].rarityScore).toBeGreaterThanOrEqual(0);
			expect(collection.items[0].rarityRank).toBeGreaterThanOrEqual(0);
		});
	});

	describe('loadFromStorage', () => {
		it('loads collections from storage', async () => {
			const mockCollections = [
				{
					id: 'col-1',
					name: 'Stored Collection',
					description: 'Test',
					projectName: 'Test',
					items: [],
					generatedAt: new Date(),
					totalSupply: 0
				}
			];

			vi.mocked(galleryStorage.getAllCollections).mockResolvedValue(mockCollections);

			await galleryStore.loadFromStorage();

			expect(galleryStore.collections).toHaveLength(1);
			expect(galleryStore.collections[0].name).toBe('Stored Collection');
		});

		it('handles empty storage', async () => {
			vi.mocked(galleryStorage.getAllCollections).mockResolvedValue([]);

			await galleryStore.loadFromStorage();

			expect(galleryStore.collections).toHaveLength(0);
		});
	});

	describe('clearGallery', () => {
		it('clears all collections and state', async () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			galleryStore.importCollection(items, 'Test', 'Test');
			expect(galleryStore.collections).toHaveLength(1);

			await galleryStore.clearGallery();

			expect(galleryStore.collections).toHaveLength(0);
			expect(galleryStore.selectedItem).toBeNull();
			expect(galleryStore.selectedCollection).toBeNull();
			expect(galleryStorage.clearAllCollections).toHaveBeenCalled();
		});
	});

	describe('setSelectedCollection', () => {
		it('sets selected collection', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			const collection = galleryStore.importCollection(items, 'Test', 'Test');
			galleryStore.setSelectedCollection(collection);

			expect(galleryStore.selectedCollection).toStrictEqual(collection);
		});

		it('clears selected collection', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			const collection = galleryStore.importCollection(items, 'Test', 'Test');
			galleryStore.setSelectedCollection(collection);
			galleryStore.setSelectedCollection(null);

			expect(galleryStore.selectedCollection).toBeNull();
		});
	});

	describe('removeCollection', () => {
		it('removes collection by id', async () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			const collection = galleryStore.importCollection(items, 'Test', 'Test');
			expect(galleryStore.collections).toHaveLength(1);

			await galleryStore.removeCollection(collection.id);

			expect(galleryStore.collections).toHaveLength(0);
			expect(galleryStorage.deleteCollection).toHaveBeenCalledWith(collection.id);
		});

		it('clears selected collection if removed', async () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				}
			];

			const collection = galleryStore.importCollection(items, 'Test', 'Test');
			galleryStore.setSelectedCollection(collection);

			await galleryStore.removeCollection(collection.id);

			expect(galleryStore.selectedCollection).toBeNull();
		});
	});

	describe('filteredAndSortedItems', () => {
		it('returns all items when no filters', () => {
			const items = [
				{
					name: 'Item 1',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				},
				{
					name: 'Item 2',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 1
				}
			];

			galleryStore.importCollection(items, 'Test', 'Test');

			expect(galleryStore.filteredAndSortedItems).toHaveLength(2);
		});

		it('filters by search term', () => {
			const items = [
				{
					name: 'Blue Item',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 0
				},
				{
					name: 'Red Item',
					imageData: new ArrayBuffer(100),
					metadata: { traits: [] },
					index: 1
				}
			];

			galleryStore.importCollection(items, 'Test', 'Test');
			galleryStore.setFilterOptions({ search: 'blue' });

			expect(galleryStore.filteredAndSortedItems).toHaveLength(1);
			expect(galleryStore.filteredAndSortedItems[0].name).toBe('Blue Item');
		});
	});
});
