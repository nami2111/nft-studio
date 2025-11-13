/**
 * Persistence layer abstractions for NFT Studio.
 * Provides smart storage management with quota monitoring and fallback strategies.
 */

import { handleStorageError } from '$lib/utils/error-handler';
import { arrayBufferToBase64, base64ToArrayBuffer } from '$lib/utils';

export interface PersistenceStore<T> {
	key: string;
	save(value: T): Promise<void>;
	load(): Promise<T | null>;
	clear(): Promise<void>;
}

// Storage quota management
const STORAGE_QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB limit for localStorage
const LARGE_PROJECT_THRESHOLD = 2 * 1024 * 1024; // 2MB threshold for large projects

/**
 * Get estimated storage size
 */
function getStorageSize(data: unknown): number {
	try {
		const serialized = JSON.stringify(data);
		return new Blob([serialized]).size;
	} catch {
		return 0;
	}
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
		// Check storage size before saving
		const estimatedSize = getStorageSize(value);
		if (estimatedSize > STORAGE_QUOTA_LIMIT) {
			console.warn(
				`Storage warning: Attempting to save ${Math.round(estimatedSize / 1024)}KB, limit is ${Math.round(STORAGE_QUOTA_LIMIT / 1024)}KB`
			);

			// For large projects, save only essential metadata
			const compactValue = createCompactVersion(value);
			const compactSize = getStorageSize(compactValue);

			if (compactSize > STORAGE_QUOTA_LIMIT) {
				console.error('Project too large for localStorage, consider using IndexedDB');
				throw new Error('Project size exceeds localStorage quota');
			}

			const serialized = serializeArrayBuffers(compactValue);
			localStorage.setItem(key, JSON.stringify(serialized));
			console.info(`Saved compact version (${Math.round(compactSize / 1024)}KB) to localStorage`);
			return;
		}

		const serialized = serializeArrayBuffers(value);
		localStorage.setItem(key, JSON.stringify(serialized));
	} catch (error) {
		handleStorageError(error, {
			context: { component: 'LocalStorage', action: 'saveToLocalStorageSync' },
			silent: true
		});
	}
}

/**
 * Create a compact version of the project for localStorage
 */
function createCompactVersion<T>(value: T): T {
	// This is a placeholder - in a real implementation, you would:
	// 1. Remove image data from NFTs
	// 2. Remove preview URLs
	// 3. Keep only essential metadata
	// 4. Compress layer data
	return value;
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

// Minimal IndexedDB adapter (primary storage for large projects)
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
				req.onblocked = () => reject(new Error('IndexedDB blocked'));
			} catch (e) {
				// IndexedDB not available
				reject(e as Error);
			}
		});
	}

	async save(value: T): Promise<void> {
		try {
			const db = await this.open();
			const tx = db.transaction([this.storeName], 'readwrite');
			const store = tx.objectStore(this.storeName);

			// Clean the value to remove non-serializable objects
			const cleanValue = this.cleanForSerialization(value);
			store.put({ key: this.key, value: cleanValue });

			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'IndexedDB', action: 'save' },
				silent: true
			});
			// Fallback to localStorage for small data
			try {
				const estimatedSize = this.getEstimatedSize(value);
				if (estimatedSize < 1024 * 1024) {
					// 1MB fallback limit
					saveToLocalStorageSync(this.key, value);
				}
			} catch (fallbackError) {
				console.error('Storage fallback failed:', fallbackError);
			}
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
			// Fallback to localStorage
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

	/**
	 * Clean object for IndexedDB serialization
	 */
	private cleanForSerialization(obj: any): any {
		if (obj === null || obj === undefined) {
			return obj;
		}

		if (typeof obj === 'object') {
			if (Array.isArray(obj)) {
				return obj.map((item) => this.cleanForSerialization(item));
			}

			// Create clean object without non-serializable properties
			const result: Record<string, any> = {};
			for (const [key, value] of Object.entries(obj)) {
				try {
					// Skip functions, symbols, and other problematic types
					if (
						typeof value !== 'function' &&
						typeof value !== 'symbol' &&
						value !== window &&
						value !== document
					) {
						result[key] = this.cleanForSerialization(value);
					}
				} catch (error) {
					console.warn(`Skipping non-serializable property ${key}:`, error);
				}
			}
			return result;
		}

		return obj;
	}

	/**
	 * Get estimated size of object
	 */
	private getEstimatedSize(obj: any): number {
		try {
			return new Blob([JSON.stringify(obj)]).size;
		} catch {
			return 0;
		}
	}
}

/**
 * Smart storage manager that chooses the best storage method
 */
export class SmartStorageStore<T> implements PersistenceStore<T> {
	constructor(
		public key: string,
		private localStorageStore = new LocalStorageStore<T>(key),
		private indexedDbStore = new IndexedDbStore<T>(key)
	) {}

	async save(value: T): Promise<void> {
		try {
			// Get estimated size first
			const estimatedSize = getStorageSize(value);
			console.log(`SmartStorage: Project size ${Math.round(estimatedSize / 1024)}KB`);

			// Use IndexedDB for large projects (>2MB)
			if (estimatedSize > LARGE_PROJECT_THRESHOLD) {
				console.info(
					`SmartStorage: Using IndexedDB for large project (${Math.round(estimatedSize / 1024)}KB)`
				);
				await this.indexedDbStore.save(value);
			} else {
				// Use localStorage for smaller projects
				console.info(
					`SmartStorage: Using localStorage for small project (${Math.round(estimatedSize / 1024)}KB)`
				);
				this.localStorageStore.save(value);
			}
		} catch (error) {
			console.error('SmartStorage: Primary storage failed:', error);

			// Fallback to alternative storage
			try {
				const estimatedSize = getStorageSize(value);
				if (estimatedSize > LARGE_PROJECT_THRESHOLD) {
					// If IndexedDB failed, try localStorage (might work for smaller actual size)
					console.warn('SmartStorage: IndexedDB failed, trying localStorage fallback');
					this.localStorageStore.save(value);
				} else {
					// If localStorage failed, try IndexedDB
					console.warn('SmartStorage: localStorage failed, trying IndexedDB fallback');
					await this.indexedDbStore.save(value);
				}
			} catch (fallbackError) {
				console.error('SmartStorage: Both storage methods failed:', fallbackError);
				throw new Error('All storage methods failed');
			}
		}
	}

	async load(): Promise<T | null> {
		try {
			// Try localStorage first (faster)
			const localStorageData = await this.localStorageStore.load();
			if (localStorageData) {
				return localStorageData;
			}

			// Fallback to IndexedDB
			return await this.indexedDbStore.load();
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'SmartStorage', action: 'load' },
				silent: false // Show error for smart storage failures
			});
			return null;
		}
	}

	async clear(): Promise<void> {
		try {
			await Promise.all([this.localStorageStore.clear(), this.indexedDbStore.clear()]);
		} catch (error) {
			handleStorageError(error, {
				context: { component: 'SmartStorage', action: 'clear' },
				silent: true
			});
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
