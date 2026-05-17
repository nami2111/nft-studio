import { openDB, type IDBPDatabase } from 'idb';
import { getStorageBackend } from '$lib/storage/backend';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import type { GalleryCollection, GalleryItem } from '$lib/types/gallery';
import type { Layer, Project, Trait } from '$lib/types/project';
import {
	type LegacyMigrationReader,
	type MigrationCounts,
	type MigrationManifest,
	type MigrationResult
} from './types';

export const INDEXEDDB_TO_OPFS_MIGRATION_ID = 'indexeddb-to-opfs-v1';

const PROJECT_METADATA_KEY = 'gnstudio-project-metadata';
const LEGACY_PROJECT_KEY = 'gnstudio-project';
const LAYER_ASSETS_PREFIX = 'gnstudio-layer-assets-';
const PROJECT_ASSETS_DB_NAME = 'gnstudio-assets';
const PROJECT_ASSETS_STORE_NAME = 'store';
const OLD_PROJECT_DB_NAME = 'gnstudio';
const OLD_PROJECT_STORE_NAME = 'projects';
const GALLERY_DB_NAME = 'gnstudio-gallery';
const GALLERY_DB_VERSION = 3;
const GALLERY_COLLECTIONS_STORE = 'collections';
const GALLERY_IMAGES_STORE = 'gallery-images';

interface IndexedDbKeyValueRecord<T> {
	key: string;
	value: T;
}

interface LegacyLayerAssets {
	layerId: string;
	traits: { id: string; imageData: ArrayBuffer }[];
}

type StoredProjectTrait = Omit<Trait, 'imageData' | 'imageUrl'> & {
	imageData?: never;
	imageUrl?: never;
};

type StoredProjectLayer = Omit<Layer, 'traits'> & {
	traits: StoredProjectTrait[];
};

type StoredProjectManifest = Omit<Project, 'layers'> & {
	layers: StoredProjectLayer[];
};

type StoredGalleryItem = Omit<
	GalleryItem,
	'generatedAt' | 'imageData' | 'imageUrl' | 'isBlobUrl'
> & {
	generatedAt: string | Date;
	imageData?: never;
	imageUrl?: never;
	isBlobUrl?: never;
};

type StoredGalleryCollection = Omit<GalleryCollection, 'generatedAt' | 'items'> & {
	generatedAt: string | Date;
	items: StoredGalleryItem[];
};

interface GalleryIndex {
	collectionIds: string[];
	updatedAt: number;
}

interface GalleryItemLookup {
	collectionId: string;
	updatedAt: number;
}

const emptyCounts = (): MigrationCounts => ({
	projectCount: 0,
	layerCount: 0,
	traitCount: 0,
	traitBytes: 0,
	galleryCollectionCount: 0,
	galleryItemCount: 0,
	galleryImageBytes: 0
});

function createManifest(status: MigrationManifest['status']): MigrationManifest {
	return {
		id: INDEXEDDB_TO_OPFS_MIGRATION_ID,
		status,
		attempts: 0,
		counts: emptyCounts()
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function cloneJson<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
	return value instanceof ArrayBuffer;
}

function restoreArrayBuffers(value: unknown): unknown {
	if (value === null || value === undefined) return value;

	if (Array.isArray(value)) {
		return value.map((item) => restoreArrayBuffers(item));
	}

	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		if (record.__type === 'ArrayBuffer' && typeof record.data === 'string') {
			const binary = atob(record.data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return bytes.buffer;
		}

		const restored: Record<string, unknown> = {};
		for (const [key, entryValue] of Object.entries(record)) {
			restored[key] = restoreArrayBuffers(entryValue);
		}
		return restored;
	}

	return value;
}

function readLocalStorageJson<T>(key: string): T | null {
	if (typeof localStorage === 'undefined') return null;

	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return restoreArrayBuffers(JSON.parse(raw)) as T;
	} catch {
		return null;
	}
}

function normalizeProject(project: Project): Project {
	return {
		...project,
		layers: project.layers.map((layer) => ({
			...layer,
			traits: layer.traits.map((trait) => ({
				...trait,
				imageData: isArrayBuffer(trait.imageData) ? trait.imageData : new ArrayBuffer(0),
				imageUrl: undefined
			}))
		}))
	};
}

function createProjectManifest(project: Project): StoredProjectManifest {
	return {
		...project,
		layers: project.layers.map((layer) => ({
			...layer,
			traits: layer.traits.map((trait) => {
				const { imageData: _imageData, imageUrl: _imageUrl, ...storedTrait } = trait;
				return storedTrait;
			})
		}))
	};
}

function hydrateProjectManifest(manifest: StoredProjectManifest): Project {
	return normalizeProject({
		...manifest,
		layers: manifest.layers.map((layer) => ({
			...layer,
			traits: layer.traits.map((trait) => ({
				...trait,
				imageData: new ArrayBuffer(0)
			}))
		}))
	} as Project);
}

function serializeGalleryCollection(collection: GalleryCollection): StoredGalleryCollection {
	return {
		id: collection.id,
		name: collection.name,
		description: collection.description,
		projectName: collection.projectName,
		generatedAt:
			collection.generatedAt instanceof Date
				? collection.generatedAt.toISOString()
				: collection.generatedAt,
		totalSupply: collection.totalSupply,
		items: collection.items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			imageFormat: item.imageFormat,
			metadata: cloneJson(item.metadata),
			rarityScore: item.rarityScore,
			rarityRank: item.rarityRank,
			collectionId: item.collectionId,
			generatedAt:
				item.generatedAt instanceof Date ? item.generatedAt.toISOString() : item.generatedAt
		}))
	};
}

function hydrateGalleryCollection(stored: StoredGalleryCollection): GalleryCollection {
	return {
		id: stored.id,
		name: stored.name,
		description: stored.description,
		projectName: stored.projectName,
		generatedAt: stored.generatedAt ? new Date(stored.generatedAt) : new Date(),
		totalSupply: stored.totalSupply,
		items: stored.items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			imageFormat: item.imageFormat,
			metadata: item.metadata,
			rarityScore: item.rarityScore,
			rarityRank: item.rarityRank,
			collectionId: item.collectionId,
			generatedAt: item.generatedAt ? new Date(item.generatedAt) : new Date(),
			imageData: new ArrayBuffer(0)
		}))
	};
}

async function openKeyValueDatabase(dbName: string): Promise<IDBPDatabase | null> {
	if (typeof indexedDB === 'undefined') return null;

	try {
		return await openDB(dbName, 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(PROJECT_ASSETS_STORE_NAME)) {
					db.createObjectStore(PROJECT_ASSETS_STORE_NAME, { keyPath: 'key' });
				}
			}
		});
	} catch {
		return null;
	}
}

async function readProjectKeyValue<T>(key: string): Promise<T | null> {
	const db = await openKeyValueDatabase(PROJECT_ASSETS_DB_NAME);
	if (!db || !db.objectStoreNames.contains(PROJECT_ASSETS_STORE_NAME)) return null;

	const record = (await db.get(PROJECT_ASSETS_STORE_NAME, key)) as
		| IndexedDbKeyValueRecord<T>
		| undefined;
	return record?.value ?? null;
}

async function readOldProjectWrapper(): Promise<Project | null> {
	if (typeof indexedDB === 'undefined') return null;

	try {
		const db = await openDB(OLD_PROJECT_DB_NAME, 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(OLD_PROJECT_STORE_NAME)) {
					db.createObjectStore(OLD_PROJECT_STORE_NAME, { keyPath: 'id' });
				}
			}
		});

		if (!db.objectStoreNames.contains(OLD_PROJECT_STORE_NAME)) return null;
		const record = (await db.get(OLD_PROJECT_STORE_NAME, 'current')) as
			| { data?: Project }
			| undefined;
		return record?.data ? normalizeProject(record.data) : null;
	} catch {
		return null;
	}
}

async function readLayerAssets(layerId: string): Promise<LegacyLayerAssets | null> {
	return await readProjectKeyValue<LegacyLayerAssets>(`${LAYER_ASSETS_PREFIX}${layerId}`);
}

async function hydrateProjectFromLayerAssets(project: Project): Promise<Project> {
	await Promise.all(
		project.layers.map(async (layer) => {
			const assets = await readLayerAssets(layer.id);
			if (!assets?.traits) return;

			for (const assetTrait of assets.traits) {
				const trait = layer.traits.find((projectTrait) => projectTrait.id === assetTrait.id);
				if (trait && isArrayBuffer(assetTrait.imageData)) {
					trait.imageData = assetTrait.imageData;
				}
			}
		})
	);

	return project;
}

async function openGalleryDatabase(): Promise<IDBPDatabase | null> {
	if (typeof indexedDB === 'undefined') return null;

	try {
		return await openDB(GALLERY_DB_NAME, GALLERY_DB_VERSION, {
			upgrade(db, oldVersion) {
				if (!db.objectStoreNames.contains(GALLERY_COLLECTIONS_STORE)) {
					const store = db.createObjectStore(GALLERY_COLLECTIONS_STORE, {
						keyPath: 'id'
					});
					store.createIndex('name', 'name', { unique: false });
					store.createIndex('generatedAt', 'generatedAt', { unique: false });
					store.createIndex('projectName', 'projectName', { unique: false });
					store.createIndex('totalSupply', 'totalSupply', { unique: false });
				}

				if (oldVersion < 3 && !db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) {
					const imageStore = db.createObjectStore(GALLERY_IMAGES_STORE, {
						keyPath: 'itemId'
					});
					imageStore.createIndex('collectionId', 'collectionId', { unique: false });
				}
			}
		});
	} catch {
		return null;
	}
}

export function createBrowserLegacyMigrationReader(): LegacyMigrationReader {
	return {
		async readProject() {
			const localManifest = readLocalStorageJson<StoredProjectManifest>(PROJECT_METADATA_KEY);
			if (localManifest) {
				return await hydrateProjectFromLayerAssets(hydrateProjectManifest(localManifest));
			}

			const indexedManifest =
				await readProjectKeyValue<StoredProjectManifest>(PROJECT_METADATA_KEY);
			if (indexedManifest) {
				return await hydrateProjectFromLayerAssets(hydrateProjectManifest(indexedManifest));
			}

			const localLegacyProject = readLocalStorageJson<Project>(LEGACY_PROJECT_KEY);
			if (localLegacyProject) {
				return normalizeProject(localLegacyProject);
			}

			const indexedLegacyProject = await readProjectKeyValue<Project>(LEGACY_PROJECT_KEY);
			if (indexedLegacyProject) {
				return normalizeProject(indexedLegacyProject);
			}

			return await readOldProjectWrapper();
		},

		async readGalleryCollections() {
			const db = await openGalleryDatabase();
			if (!db || !db.objectStoreNames.contains(GALLERY_COLLECTIONS_STORE)) return [];

			const storedCollections = (await db.getAll(
				GALLERY_COLLECTIONS_STORE
			)) as StoredGalleryCollection[];
			return storedCollections.map(hydrateGalleryCollection);
		},

		async readGalleryItemImage(itemId: string) {
			const db = await openGalleryDatabase();
			if (!db || !db.objectStoreNames.contains(GALLERY_IMAGES_STORE)) return null;

			const record = (await db.get(GALLERY_IMAGES_STORE, itemId)) as
				| { imageData?: ArrayBuffer }
				| undefined;
			return record?.imageData instanceof ArrayBuffer ? record.imageData : null;
		}
	};
}

async function readMigrationManifest(backend: ObjectStorageBackend): Promise<MigrationManifest> {
	return (
		(await backend.json.readJson<MigrationManifest>(
			storagePaths.migrationManifest(INDEXEDDB_TO_OPFS_MIGRATION_ID)
		)) ?? createManifest('not-started')
	);
}

async function writeMigrationManifest(
	backend: ObjectStorageBackend,
	manifest: MigrationManifest
): Promise<void> {
	await backend.json.writeJson(
		storagePaths.migrationManifest(INDEXEDDB_TO_OPFS_MIGRATION_ID),
		manifest
	);
}

async function writeProject(
	backend: ObjectStorageBackend,
	project: Project | null
): Promise<MigrationCounts> {
	const counts = emptyCounts();
	if (!project) return counts;

	const normalizedProject = normalizeProject(project);
	const manifest = createProjectManifest(normalizedProject);

	await Promise.all(
		normalizedProject.layers.map(async (layer) => {
			await Promise.all(
				layer.traits.map(async (trait) => {
					if (!isArrayBuffer(trait.imageData) || trait.imageData.byteLength === 0) return;

					await backend.binary.write(
						storagePaths.projectTraitAsset(layer.id, trait.id),
						trait.imageData
					);
					counts.traitBytes += trait.imageData.byteLength;
				})
			);
		})
	);

	await backend.json.writeJson(storagePaths.projectManifest(), manifest);

	counts.projectCount = 1;
	counts.layerCount = normalizedProject.layers.length;
	counts.traitCount = normalizedProject.layers.reduce((sum, layer) => sum + layer.traits.length, 0);
	return counts;
}

async function writeGallery(
	backend: ObjectStorageBackend,
	reader: LegacyMigrationReader,
	collections: GalleryCollection[]
): Promise<MigrationCounts> {
	const counts = emptyCounts();
	const collectionIds: string[] = [];

	for (const collection of collections) {
		const storedCollection = serializeGalleryCollection(collection);
		collectionIds.push(collection.id);

		for (const item of collection.items) {
			const imageData =
				item.imageData instanceof ArrayBuffer && item.imageData.byteLength > 0
					? item.imageData
					: await reader.readGalleryItemImage(item.id);

			if (imageData && imageData.byteLength > 0) {
				await backend.binary.write(
					storagePaths.galleryItemImage(collection.id, item.id),
					imageData
				);
				await backend.json.writeJson(storagePaths.galleryItemLookup(item.id), {
					collectionId: collection.id,
					updatedAt: Date.now()
				} satisfies GalleryItemLookup);
				counts.galleryImageBytes += imageData.byteLength;
			}
		}

		await backend.json.writeJson(
			storagePaths.galleryCollectionManifest(collection.id),
			storedCollection
		);
	}

	await backend.json.writeJson(storagePaths.galleryIndex(), {
		collectionIds: Array.from(new Set(collectionIds)),
		updatedAt: Date.now()
	} satisfies GalleryIndex);

	counts.galleryCollectionCount = collections.length;
	counts.galleryItemCount = collections.reduce(
		(sum, collection) => sum + collection.items.length,
		0
	);
	return counts;
}

function addCounts(left: MigrationCounts, right: MigrationCounts): MigrationCounts {
	return {
		projectCount: left.projectCount + right.projectCount,
		layerCount: left.layerCount + right.layerCount,
		traitCount: left.traitCount + right.traitCount,
		traitBytes: left.traitBytes + right.traitBytes,
		galleryCollectionCount: left.galleryCollectionCount + right.galleryCollectionCount,
		galleryItemCount: left.galleryItemCount + right.galleryItemCount,
		galleryImageBytes: left.galleryImageBytes + right.galleryImageBytes
	};
}

async function verifyProjectMigration(
	backend: ObjectStorageBackend,
	project: Project | null,
	expected: MigrationCounts
): Promise<void> {
	if (!project) return;

	const manifest = await backend.json.readJson<StoredProjectManifest>(
		storagePaths.projectManifest()
	);
	if (!manifest) {
		throw new Error('Project manifest was not written.');
	}

	const layerCount = manifest.layers.length;
	const traitCount = manifest.layers.reduce((sum, layer) => sum + layer.traits.length, 0);
	let traitBytes = 0;

	for (const layer of project.layers) {
		for (const trait of layer.traits) {
			traitBytes += await backend.binary.size(storagePaths.projectTraitAsset(layer.id, trait.id));
		}
	}

	if (
		layerCount !== expected.layerCount ||
		traitCount !== expected.traitCount ||
		traitBytes !== expected.traitBytes
	) {
		throw new Error('Project migration verification failed.');
	}
}

async function verifyGalleryMigration(
	backend: ObjectStorageBackend,
	collections: GalleryCollection[],
	expected: MigrationCounts
): Promise<void> {
	const index = await backend.json.readJson<GalleryIndex>(storagePaths.galleryIndex());
	if (!index) {
		throw new Error('Gallery index was not written.');
	}

	let itemCount = 0;
	let imageBytes = 0;

	for (const collection of collections) {
		const manifest = await backend.json.readJson<StoredGalleryCollection>(
			storagePaths.galleryCollectionManifest(collection.id)
		);
		if (!manifest) {
			throw new Error(`Gallery collection manifest was not written: ${collection.id}`);
		}

		itemCount += manifest.items.length;
		for (const item of collection.items) {
			imageBytes += await backend.binary.size(
				storagePaths.galleryItemImage(collection.id, item.id)
			);
		}
	}

	if (
		index.collectionIds.length !== expected.galleryCollectionCount ||
		itemCount !== expected.galleryItemCount ||
		imageBytes !== expected.galleryImageBytes
	) {
		throw new Error('Gallery migration verification failed.');
	}
}

export async function migrateIndexedDbToOpfs(
	backend: ObjectStorageBackend,
	reader: LegacyMigrationReader = createBrowserLegacyMigrationReader()
): Promise<MigrationResult> {
	const existingManifest = await readMigrationManifest(backend);
	if (existingManifest.status === 'completed') {
		return {
			id: INDEXEDDB_TO_OPFS_MIGRATION_ID,
			status: 'completed',
			skipped: true,
			manifest: existingManifest
		};
	}

	const startedManifest: MigrationManifest = {
		...existingManifest,
		id: INDEXEDDB_TO_OPFS_MIGRATION_ID,
		status: 'running',
		startedAt: Date.now(),
		completedAt: undefined,
		failedAt: undefined,
		error: undefined,
		attempts: existingManifest.attempts + 1
	};
	await writeMigrationManifest(backend, startedManifest);

	try {
		const [project, galleryCollections] = await Promise.all([
			reader.readProject(),
			reader.readGalleryCollections()
		]);
		const projectCounts = await writeProject(backend, project);
		const galleryCounts = await writeGallery(backend, reader, galleryCollections);
		const counts = addCounts(projectCounts, galleryCounts);

		await verifyProjectMigration(backend, project, projectCounts);
		await verifyGalleryMigration(backend, galleryCollections, galleryCounts);

		const completedManifest: MigrationManifest = {
			...startedManifest,
			status: 'completed',
			completedAt: Date.now(),
			counts
		};
		await writeMigrationManifest(backend, completedManifest);

		return {
			id: INDEXEDDB_TO_OPFS_MIGRATION_ID,
			status: 'completed',
			skipped: false,
			manifest: completedManifest
		};
	} catch (error) {
		const failedManifest: MigrationManifest = {
			...startedManifest,
			status: 'failed',
			failedAt: Date.now(),
			error: errorMessage(error)
		};
		await writeMigrationManifest(backend, failedManifest);
		throw error;
	}
}

let migrationRun: Promise<MigrationResult> | null = null;

export async function runIndexedDbToOpfsMigration(): Promise<MigrationResult> {
	if (migrationRun) return migrationRun;

	migrationRun = (async () => {
		const backend = await getStorageBackend();

		if (backend.kind === 'indexeddb-legacy') {
			return {
				id: INDEXEDDB_TO_OPFS_MIGRATION_ID,
				status: 'not-started',
				skipped: true,
				manifest: createManifest('not-started')
			};
		}

		return await migrateIndexedDbToOpfs(backend);
	})();

	try {
		return await migrationRun;
	} finally {
		migrationRun = null;
	}
}
