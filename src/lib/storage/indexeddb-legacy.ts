import { openDB, type IDBPDatabase } from 'idb';
import type { BinaryObjectStore, JsonObjectStore, ObjectStorageBackend } from './types';

const DB_NAME = 'gnstudio-storage-legacy';
const DB_VERSION = 1;
const BINARY_STORE = 'binary';
const JSON_STORE = 'json';

interface BinaryRecord {
	path: string;
	data: ArrayBuffer;
}

interface JsonRecord {
	path: string;
	value: unknown;
}

let dbInstance: IDBPDatabase | null = null;

async function openLegacyStorageDatabase(): Promise<IDBPDatabase> {
	if (dbInstance) return dbInstance;

	dbInstance = await openDB(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(BINARY_STORE)) {
				db.createObjectStore(BINARY_STORE, { keyPath: 'path' });
			}

			if (!db.objectStoreNames.contains(JSON_STORE)) {
				db.createObjectStore(JSON_STORE, { keyPath: 'path' });
			}
		}
	});

	return dbInstance;
}

function isPathInTree(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

class IndexedDbLegacyObjectStore implements BinaryObjectStore, JsonObjectStore {
	async write(path: string, data: ArrayBuffer): Promise<void> {
		const db = await openLegacyStorageDatabase();
		await db.put(BINARY_STORE, { path, data: data.slice(0) } satisfies BinaryRecord);
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const db = await openLegacyStorageDatabase();
		const record = (await db.get(BINARY_STORE, path)) as BinaryRecord | undefined;
		return record?.data ? record.data.slice(0) : null;
	}

	async exists(path: string): Promise<boolean> {
		const db = await openLegacyStorageDatabase();
		return (
			(await db.getKey(BINARY_STORE, path)) !== undefined ||
			(await db.getKey(JSON_STORE, path)) !== undefined
		);
	}

	async remove(path: string): Promise<void> {
		const db = await openLegacyStorageDatabase();
		const tx = db.transaction([BINARY_STORE, JSON_STORE], 'readwrite');
		await Promise.all([
			tx.objectStore(BINARY_STORE).delete(path),
			tx.objectStore(JSON_STORE).delete(path)
		]);
		await tx.done;
	}

	async removeTree(path: string): Promise<void> {
		const db = await openLegacyStorageDatabase();
		const [binaryKeys, jsonKeys] = await Promise.all([
			db.getAllKeys(BINARY_STORE),
			db.getAllKeys(JSON_STORE)
		]);

		const tx = db.transaction([BINARY_STORE, JSON_STORE], 'readwrite');

		for (const key of binaryKeys) {
			if (typeof key === 'string' && isPathInTree(key, path)) {
				tx.objectStore(BINARY_STORE).delete(key);
			}
		}

		for (const key of jsonKeys) {
			if (typeof key === 'string' && isPathInTree(key, path)) {
				tx.objectStore(JSON_STORE).delete(key);
			}
		}

		await tx.done;
	}

	async list(path: string): Promise<string[]> {
		const db = await openLegacyStorageDatabase();
		const prefix = path.endsWith('/') ? path : `${path}/`;
		const names = new Set<string>();

		for (const storeName of [BINARY_STORE, JSON_STORE]) {
			for (const key of await db.getAllKeys(storeName)) {
				if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
				const child = key.slice(prefix.length).split('/')[0];
				if (child) names.add(child);
			}
		}

		return Array.from(names).sort();
	}

	async size(path: string): Promise<number> {
		const data = await this.read(path);
		if (data) return data.byteLength;

		const db = await openLegacyStorageDatabase();
		const record = (await db.get(JSON_STORE, path)) as JsonRecord | undefined;
		return record ? new Blob([JSON.stringify(record.value)]).size : 0;
	}

	async writeJson<T>(path: string, value: T): Promise<void> {
		const db = await openLegacyStorageDatabase();
		await db.put(JSON_STORE, { path, value: structuredClone(value) } satisfies JsonRecord);
	}

	async readJson<T>(path: string): Promise<T | null> {
		const db = await openLegacyStorageDatabase();
		const record = (await db.get(JSON_STORE, path)) as JsonRecord | undefined;
		return record ? (structuredClone(record.value) as T) : null;
	}

	async removeJson(path: string): Promise<void> {
		const db = await openLegacyStorageDatabase();
		await db.delete(JSON_STORE, path);
	}
}

export function createIndexedDbLegacyStorageBackend(): ObjectStorageBackend {
	const store = new IndexedDbLegacyObjectStore();

	return {
		kind: 'indexeddb-legacy',
		binary: store,
		json: store,
		available: async () => typeof indexedDB !== 'undefined'
	};
}
