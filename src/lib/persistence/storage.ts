/**
 * Persistence layer abstractions for NFT Studio.
 * Provides simple sync/localStorage-based store and async IndexedDB adapter.
 */

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
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function saveToLocalStorageSync<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeFromLocalStorageSync(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
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
  constructor(public key: string, private dbName: string = 'nft-studio', private storeName: string = 'store') {}

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
        reject(e as any);
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
    } catch {
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
    } catch {
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
    } catch {
      removeFromLocalStorageSync(this.key);
    }
  }
}

