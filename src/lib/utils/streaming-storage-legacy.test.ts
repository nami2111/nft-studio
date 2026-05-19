import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { setStorageBackendForTesting } from '$lib/storage/backend';
import type { ObjectStorageBackend } from '$lib/storage/types';

const legacyIdbMock = vi.hoisted(() => {
	interface MockIndexedDb {
		objectStoreNames: {
			contains(name: string): boolean;
		};
		createObjectStore(name: string): Map<string, unknown>;
		transaction(storeNames: string | string[]): {
			objectStore(name: string): {
				put(record: { key: string }): void;
				delete(key: IDBValidKey): void;
			};
			done: Promise<void>;
		};
		getAllKeys(name: string): Promise<string[]>;
		get(name: string, key: IDBValidKey): Promise<unknown>;
		reset(): void;
	}

	const stores = new Map<string, Map<string, unknown>>();

	function getStore(name: string): Map<string, unknown> {
		let store = stores.get(name);
		if (!store) {
			store = new Map<string, unknown>();
			stores.set(name, store);
		}

		return store;
	}

	const db: MockIndexedDb = {
		objectStoreNames: {
			contains: (name: string) => stores.has(name)
		},
		createObjectStore: (name: string) => getStore(name),
		transaction: (storeNames: string | string[]) => {
			const requestedStores = Array.isArray(storeNames) ? storeNames : [storeNames];
			for (const name of requestedStores) {
				getStore(name);
			}

			return {
				objectStore: (name: string) => ({
					put: (record: { key: string }) => {
						getStore(name).set(record.key, record);
					},
					delete: (key: IDBValidKey) => {
						getStore(name).delete(String(key));
					}
				}),
				done: Promise.resolve()
			};
		},
		getAllKeys: async (name: string) => Array.from(getStore(name).keys()),
		get: async (name: string, key: IDBValidKey) => getStore(name).get(String(key)),
		reset: () => {
			stores.clear();
		}
	};

	return {
		db,
		openDB: async (
			_name: string,
			_version: number,
			options?: { upgrade?: (db: MockIndexedDb) => void }
		) => {
			options?.upgrade?.(db);
			return db;
		}
	};
});

vi.mock('idb', () => ({
	openDB: legacyIdbMock.openDB
}));

const legacyBackend = {
	kind: 'indexeddb-legacy',
	binary: {
		write: async () => {},
		read: async () => null,
		exists: async () => false,
		remove: async () => {},
		removeTree: async () => {},
		list: async () => [],
		size: async () => 0
	},
	json: {
		writeJson: async () => {},
		readJson: async () => null,
		removeJson: async () => {}
	},
	available: async () => true
} satisfies ObjectStorageBackend;

const { cleanupStaleGenerationSessions, iterateBySize, streamBatch } =
	await import('./streaming-storage');

function buffer(bytes: number, fill = 1): ArrayBuffer {
	return new Uint8Array(Array.from({ length: bytes }, () => fill)).buffer;
}

async function imageNamesForSession(sessionId: string): Promise<string[]> {
	const imageNames: string[] = [];
	await iterateBySize(sessionId, 100, async (batch) => {
		imageNames.push(...batch.images.map((image) => image.name));
	});

	return imageNames;
}

describe('legacy IndexedDB streaming cleanup', () => {
	beforeEach(() => {
		legacyIdbMock.db.reset();
		setStorageBackendForTesting(legacyBackend);
	});

	afterEach(() => {
		setStorageBackendForTesting(null);
		legacyIdbMock.db.reset();
	});

	it('removes stale generation sessions from the legacy IndexedDB backend', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const oldSession = 'gen-1000-old';
		const freshSession = 'gen-9000-fresh';
		const activeSession = 'gen-1000-active';

		await streamBatch(
			oldSession,
			0,
			[{ name: 'old.png', imageData: buffer(2) }],
			[{ name: 'old.json', data: { id: 'old' } }]
		);
		await streamBatch(
			freshSession,
			0,
			[{ name: 'fresh.png', imageData: buffer(2) }],
			[{ name: 'fresh.json', data: { id: 'fresh' } }]
		);
		await streamBatch(
			activeSession,
			0,
			[{ name: 'active.png', imageData: buffer(2) }],
			[{ name: 'active.json', data: { id: 'active' } }]
		);

		const result = await cleanupStaleGenerationSessions({
			activeSessionIds: [activeSession],
			maxAgeMs: 5_000,
			now: 10_000
		});

		expect(result).toEqual({
			removedSessionIds: [oldSession],
			skippedSessionIds: [activeSession, freshSession],
			failedSessionIds: []
		});
		await expect(imageNamesForSession(oldSession)).resolves.toEqual([]);
		await expect(imageNamesForSession(freshSession)).resolves.toEqual(['fresh.png']);
		await expect(imageNamesForSession(activeSession)).resolves.toEqual(['active.png']);

		warn.mockRestore();
	});
});
