import { describe, expect, it, vi } from 'vite-plus/test';
import {
	LEGACY_INDEXEDDB_DATABASES,
	LEGACY_LOCAL_STORAGE_KEYS,
	OPTIONAL_LEGACY_LOCAL_STORAGE_KEYS,
	cleanupLegacyIndexedDbStorage
} from './legacy-cleanup';

function createDeleteRequest(): IDBOpenDBRequest {
	const request = {
		onsuccess: null,
		onerror: null,
		onblocked: null,
		error: null
	} as IDBOpenDBRequest;

	return request;
}

describe('legacy IndexedDB cleanup', () => {
	it('removes known legacy databases and localStorage keys only when explicitly called', async () => {
		const deletedDatabases: string[] = [];
		const removedKeys: string[] = [];
		const indexedDBFactory = {
			deleteDatabase: vi.fn((name: string) => {
				deletedDatabases.push(name);
				const request = createDeleteRequest();
				queueMicrotask(() => request.onsuccess?.({} as Event));
				return request;
			})
		};
		const localStorageStore = {
			removeItem: vi.fn((key: string) => {
				removedKeys.push(key);
			})
		};

		const result = await cleanupLegacyIndexedDbStorage({
			indexedDBFactory,
			localStorageStore,
			includeGallerySelectionKey: true
		});

		expect(result).toEqual({
			deletedDatabases: [...LEGACY_INDEXEDDB_DATABASES],
			failedDatabases: [],
			removedLocalStorageKeys: [
				...LEGACY_LOCAL_STORAGE_KEYS,
				...OPTIONAL_LEGACY_LOCAL_STORAGE_KEYS
			],
			skippedIndexedDB: false
		});
		expect(deletedDatabases).toEqual([...LEGACY_INDEXEDDB_DATABASES]);
		expect(removedKeys).toEqual([
			...LEGACY_LOCAL_STORAGE_KEYS,
			...OPTIONAL_LEGACY_LOCAL_STORAGE_KEYS
		]);
	});

	it('keeps going when one database delete fails', async () => {
		const indexedDBFactory = {
			deleteDatabase: vi.fn((name: string) => {
				const request = createDeleteRequest();
				queueMicrotask(() => {
					if (name === 'bad-db') {
						Object.defineProperty(request, 'error', {
							value: new Error('delete failed')
						});
						request.onerror?.({} as Event);
						return;
					}

					request.onsuccess?.({} as Event);
				});
				return request;
			})
		};

		const result = await cleanupLegacyIndexedDbStorage({
			databases: ['good-db', 'bad-db', 'next-db'],
			indexedDBFactory,
			localStorageStore: null
		});

		expect(result.deletedDatabases).toEqual(['good-db', 'next-db']);
		expect(result.failedDatabases).toEqual([{ name: 'bad-db', error: 'delete failed' }]);
	});

	it('can run localStorage cleanup without IndexedDB support', async () => {
		const removedKeys: string[] = [];
		const result = await cleanupLegacyIndexedDbStorage({
			indexedDBFactory: null,
			localStorageStore: {
				removeItem: (key: string) => {
					removedKeys.push(key);
				}
			}
		});

		expect(result.skippedIndexedDB).toBe(true);
		expect(result.deletedDatabases).toEqual([]);
		expect(result.removedLocalStorageKeys).toEqual([...LEGACY_LOCAL_STORAGE_KEYS]);
		expect(removedKeys).toEqual([...LEGACY_LOCAL_STORAGE_KEYS]);
	});
});
