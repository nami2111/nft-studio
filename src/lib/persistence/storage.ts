/**
 * Persistence layer abstractions for NFT Studio.
 * Provides simple sync/localStorage-based store and async IndexedDB adapter.
 */

import { handleStorageError } from '$lib/utils/error-handler';
import { arrayBufferToBase64, base64ToArrayBuffer } from '$lib/utils';

export interface PersistenceStore<T> {
	key: string;
	save(value: T): Promise<void>;
	load(): Promise<T | null>;
	clear(): Promise<void>;
}

// Lightweight helper: load from localStorage synchronously
export function loadFromLocalStorageSync<T>(key: string): T | null {
	try {
		const s = localStorage.getItem(key);
		if (!s) return null;
		const parsed = JSON.parse(s);
		return restoreArrayBuffers(parsed) as T;
	} catch (error) {
		handleStorageError(error, {
			context: { component: 'LocalStorage', action: 'loadFromLocalStorageSync' },
			silent: true
		});
		return null;
	}
}

export function saveToLocalStorageSync<T>(key: string, value: T): void {
	try {
		const serialized = serializeArrayBuffers(value);
		localStorage.setItem(key, JSON.stringify(serialized));
	} catch (error) {
		handleStorageError(error, {
			context: { component: 'LocalStorage', action: 'saveToLocalStorageSync' },
			silent: true
		});
	}
}

export function removeFromLocalStorageSync(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch (error) {
		handleStorageError(error, {
			context: { component: 'LocalStorage', action: 'removeFromLocalStorageSync' },
			silent: true
		});
	}
}

export class LocalStorageStore<T> implements PersistenceStore<T> {
	constructor(public key: string) {}

	async save(value: T): Promise<void> {
		saveToLocalStorageSync(this.key, value);
	}

	async load(): Promise<T | null> {
		return loadFromLocalStorageSync<T>(this.key);
	}

	async clear(): Promise<void> {
		removeFromLocalStorageSync(this.key);
	}
}

// Minimal IndexedDB adapter (fallback for browsers that support it)
export class IndexedDbStore<T> implements PersistenceStore<T> {
	constructor(
		public key: string,
		private dbName: string = 'nft-studio',
		private storeName: string = 'store'
	) {}

	private open(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			try {
				const req = indexedDB.open(this.dbName, 1);
				req.onupgradeneeded = () => {
					const db = req.result;
					if (!db.objectStoreNames.contains(this.storeName)) {
						db.createObjectStore(this.storeName, { keyPath: 'key' });
					}
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			} catch (e) {
				// IndexedDB not available
				reject(e as Error);
			}
		});
	}

	async save(value: T): Promise<void> {
		// Fallback to localStorage if IndexedDB isn't practical here
		try {
			const db = await this.open();
			const tx = db.transaction([this.storeName], 'readwrite');
			const store = tx.objectStore(this.storeName);
			store.put({ key: this.key, value: value });
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'IndexedDB', action: 'save' },
				silent: true
			});
			// fallback to localStorage
			saveToLocalStorageSync(this.key, value);
		}
	}

	async load(): Promise<T | null> {
		try {
			const db = await this.open();
			const tx = db.transaction([this.storeName], 'readonly');
			const store = tx.objectStore(this.storeName);
			return await new Promise<T | null>((resolve, reject) => {
				const req = store.get(this.key);
				req.onsuccess = () => resolve(req.result?.value ?? null);
				req.onerror = () => reject(req.error);
			});
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'IndexedDB', action: 'load' },
				silent: true
			});
			// fallback
			return loadFromLocalStorageSync<T>(this.key);
		}
	}

	async clear(): Promise<void> {
		try {
			const db = await this.open();
			const tx = db.transaction([this.storeName], 'readwrite');
			const store = tx.objectStore(this.storeName);
			store.delete(this.key);
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'IndexedDB', action: 'clear' },
				silent: true
			});
			removeFromLocalStorageSync(this.key);
		}
	}
}

// Helper functions for serializing/deserializing ArrayBuffer objects
function serializeArrayBuffers(obj: unknown): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (obj instanceof ArrayBuffer) {
		return {
			__type: 'ArrayBuffer',
			data: arrayBufferToBase64(obj)
		};
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => serializeArrayBuffers(item));
	}

	if (typeof obj === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = serializeArrayBuffers(value);
		}
		return result;
	}

	return obj;
}

function restoreArrayBuffers(obj: unknown): unknown {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === 'object' && !Array.isArray(obj)) {
		// Check if this is a serialized ArrayBuffer
		if ((obj as { __type?: string }).__type === 'ArrayBuffer') {
			const base64Data = (obj as { data?: string }).data;
			if (base64Data) {
				return base64ToArrayBuffer(base64Data);
			}
		}

		// Recursively process object properties
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = restoreArrayBuffers(value);
		}
		return result;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => restoreArrayBuffers(item));
	}

	return obj;
}
