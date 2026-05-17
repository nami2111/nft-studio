import { describe, expect, it } from 'vite-plus/test';
import { createMemoryStorageBackend } from '$lib/storage/memory';
import { storagePaths } from '$lib/storage/paths';
import { createLayerId, createProjectId, createTraitId } from '$lib/types/ids';
import type { GalleryCollection } from '$lib/types/gallery';
import type { Project } from '$lib/types/project';
import { INDEXEDDB_TO_OPFS_MIGRATION_ID, migrateIndexedDbToOpfs } from './indexeddb-to-opfs';
import type { LegacyMigrationReader, MigrationManifest } from './types';

function buffer(values: number[]): ArrayBuffer {
	return new Uint8Array(values).buffer;
}

function bytes(data: ArrayBuffer | null): number[] | null {
	return data ? Array.from(new Uint8Array(data)) : null;
}

function createProject(): Project {
	return {
		id: createProjectId('project-legacy'),
		name: 'Legacy Project',
		description: 'Project from legacy storage',
		outputSize: { width: 100, height: 100 },
		layers: [
			{
				id: createLayerId('layer-legacy'),
				name: 'Base',
				order: 0,
				traits: [
					{
						id: createTraitId('trait-blue'),
						name: 'Blue',
						imageData: buffer([1, 2, 3]),
						imageUrl: 'blob:legacy',
						rarityWeight: 5
					},
					{
						id: createTraitId('trait-red'),
						name: 'Red',
						imageData: buffer([4, 5]),
						rarityWeight: 3
					}
				]
			}
		]
	};
}

function createGalleryCollection(): GalleryCollection {
	return {
		id: 'collection-legacy',
		name: 'Legacy Gallery',
		description: 'Gallery from legacy storage',
		projectName: 'Legacy Project',
		generatedAt: new Date('2024-01-01T00:00:00.000Z'),
		totalSupply: 2,
		items: [
			{
				id: 'item-1',
				name: 'Item 1',
				imageData: new ArrayBuffer(0),
				imageFormat: 'png',
				metadata: {
					traits: [{ layer: 'Base', trait: 'Blue', rarity: 50 }]
				},
				rarityScore: 1,
				rarityRank: 1,
				collectionId: 'collection-legacy',
				generatedAt: new Date('2024-01-02T00:00:00.000Z')
			},
			{
				id: 'item-2',
				name: 'Item 2',
				imageData: buffer([8, 9]),
				imageFormat: 'png',
				metadata: {
					traits: [{ layer: 'Base', trait: 'Red', rarity: 50 }]
				},
				rarityScore: 2,
				rarityRank: 2,
				collectionId: 'collection-legacy',
				generatedAt: new Date('2024-01-03T00:00:00.000Z')
			}
		]
	};
}

function createReader(): LegacyMigrationReader & { calls: { project: number; gallery: number } } {
	const project = createProject();
	const gallery = createGalleryCollection();
	const galleryImages = new Map<string, ArrayBuffer>([['item-1', buffer([6, 7])]]);
	const calls = { project: 0, gallery: 0 };

	return {
		calls,
		async readProject() {
			calls.project++;
			return project;
		},
		async readGalleryCollections() {
			calls.gallery++;
			return [gallery];
		},
		async readGalleryItemImage(itemId: string) {
			return galleryImages.get(itemId) ?? null;
		}
	};
}

describe('IndexedDB to OPFS migration', () => {
	it('migrates legacy project and gallery data and can run twice without rewriting', async () => {
		const backend = createMemoryStorageBackend();
		const reader = createReader();

		const result = await migrateIndexedDbToOpfs(backend, reader);

		expect(result.status).toBe('completed');
		expect(result.skipped).toBe(false);
		expect(result.manifest.counts).toMatchObject({
			projectCount: 1,
			layerCount: 1,
			traitCount: 2,
			traitBytes: 5,
			galleryCollectionCount: 1,
			galleryItemCount: 2,
			galleryImageBytes: 4
		});
		expect(
			bytes(await backend.binary.read(storagePaths.projectTraitAsset('layer-legacy', 'trait-blue')))
		).toEqual([1, 2, 3]);
		expect(
			bytes(await backend.binary.read(storagePaths.galleryItemImage('collection-legacy', 'item-1')))
		).toEqual([6, 7]);
		expect(
			bytes(await backend.binary.read(storagePaths.galleryItemImage('collection-legacy', 'item-2')))
		).toEqual([8, 9]);
		expect(
			await backend.json.readJson(storagePaths.migrationManifest(INDEXEDDB_TO_OPFS_MIGRATION_ID))
		).toMatchObject({
			status: 'completed',
			attempts: 1
		});

		const secondResult = await migrateIndexedDbToOpfs(backend, reader);

		expect(secondResult.skipped).toBe(true);
		expect(secondResult.manifest.attempts).toBe(1);
		expect(reader.calls).toEqual({ project: 1, gallery: 1 });
		expect(
			await backend.json.readJson(storagePaths.migrationManifest(INDEXEDDB_TO_OPFS_MIGRATION_ID))
		).toMatchObject({
			status: 'completed',
			attempts: 1
		});
	});

	it('records failed status and leaves legacy reader data untouched', async () => {
		const backend = createMemoryStorageBackend();
		const legacyProject = createProject();
		const reader: LegacyMigrationReader = {
			async readProject() {
				return legacyProject;
			},
			async readGalleryCollections() {
				throw new Error('legacy gallery failed');
			},
			async readGalleryItemImage() {
				return null;
			}
		};

		await expect(migrateIndexedDbToOpfs(backend, reader)).rejects.toThrow('legacy gallery failed');

		const manifest = await backend.json.readJson<MigrationManifest>(
			storagePaths.migrationManifest(INDEXEDDB_TO_OPFS_MIGRATION_ID)
		);
		expect(manifest).toMatchObject({
			status: 'failed',
			attempts: 1,
			error: 'legacy gallery failed'
		});
		expect(bytes(legacyProject.layers[0].traits[0].imageData)).toEqual([1, 2, 3]);
		expect(await backend.json.readJson(storagePaths.projectManifest())).toBeNull();
	});
});
