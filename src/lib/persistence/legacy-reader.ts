/**
 * Read-only access to pre-OPFS storage locations, used solely to migrate old
 * persisted projects into the current object-storage backend on load.
 *
 * Writes never go here — new data is written through `getStorageBackend()`.
 */

import { base64ToArrayBuffer } from '$lib/utils';

const LEGACY_ASSETS_DB_NAME = 'gnstudio-assets';
const LEGACY_ASSETS_STORE_NAME = 'store';

/** Restore values serialized by the old localStorage writer ({__type:'ArrayBuffer'}). */
function restoreArrayBuffers(obj: unknown): unknown {
	if (obj === null || obj === undefined) return obj;

	if (typeof obj === 'object' && !Array.isArray(obj)) {
		if ((obj as { __type?: string }).__type === 'ArrayBuffer') {
			const base64Data = (obj as { data?: string }).data;
			if (base64Data) return base64ToArrayBuffer(base64Data);
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = restoreArrayBuffers(value);
		}
		return result;
	}

	if (Array.isArray(obj)) return obj.map(restoreArrayBuffers);

	return obj;
}

/** Read a JSON value written by the old localStorage-backed store. */
export function readLegacyLocalStorageJson<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return restoreArrayBuffers(JSON.parse(raw)) as T;
	} catch {
		return null;
	}
}

/** Read a value from the legacy key/value IndexedDB store ('gnstudio-assets'). */
export function readLegacyAssetStore<T>(key: string): Promise<T | null> {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null);

	return new Promise((resolve) => {
		try {
			const request = indexedDB.open(LEGACY_ASSETS_DB_NAME, 1);
			request.onupgradeneeded = () => {
				const database = request.result;
				if (!database.objectStoreNames.contains(LEGACY_ASSETS_STORE_NAME)) {
					database.createObjectStore(LEGACY_ASSETS_STORE_NAME, { keyPath: 'key' });
				}
			};
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
			request.onsuccess = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(LEGACY_ASSETS_STORE_NAME)) {
					db.close();
					resolve(null);
					return;
				}
				const tx = db.transaction([LEGACY_ASSETS_STORE_NAME], 'readonly');
				const req = tx.objectStore(LEGACY_ASSETS_STORE_NAME).get(key);
				req.onerror = () => resolve(null);
				req.onsuccess = () => {
					db.close();
					resolve((req.result?.value as T | undefined) ?? null);
				};
			};
		} catch {
			resolve(null);
		}
	});
}
