export const LEGACY_INDEXEDDB_DATABASES = [
	'gnstudio-assets',
	'gnstudio-gallery',
	'gnstudio-generation',
	'gnstudio'
] as const;

export const LEGACY_LOCAL_STORAGE_KEYS = ['gnstudio-project', 'gnstudio-project-metadata'] as const;

export const OPTIONAL_LEGACY_LOCAL_STORAGE_KEYS = ['gnstudio-gallery-selected-collection'] as const;

interface DeleteDatabaseFactory {
	deleteDatabase(name: string): IDBOpenDBRequest;
}

interface LegacyCleanupOptions {
	databases?: readonly string[];
	indexedDBFactory?: DeleteDatabaseFactory | null;
	includeGallerySelectionKey?: boolean;
	localStorageKeys?: readonly string[];
	localStorageStore?: Pick<Storage, 'removeItem'> | null;
}

export interface LegacyCleanupResult {
	deletedDatabases: string[];
	failedDatabases: Array<{ name: string; error: string }>;
	removedLocalStorageKeys: string[];
	skippedIndexedDB: boolean;
}

function getDefaultIndexedDBFactory(): DeleteDatabaseFactory | null {
	if (typeof indexedDB === 'undefined') return null;
	return indexedDB;
}

function getDefaultLocalStorage(): Pick<Storage, 'removeItem'> | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function deleteDatabase(factory: DeleteDatabaseFactory, name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = factory.deleteDatabase(name);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
		request.onblocked = () => reject(new Error(`Delete blocked for ${name}`));
	});
}

function getLocalStorageKeys(options: LegacyCleanupOptions): readonly string[] {
	if (options.localStorageKeys) {
		return options.localStorageKeys;
	}

	if (options.includeGallerySelectionKey) {
		return [...LEGACY_LOCAL_STORAGE_KEYS, ...OPTIONAL_LEGACY_LOCAL_STORAGE_KEYS];
	}

	return LEGACY_LOCAL_STORAGE_KEYS;
}

/**
 * Explicit cleanup for legacy IndexedDB/localStorage data after the migration
 * fallback window closes. This is intentionally not called by migration.
 */
export async function cleanupLegacyIndexedDbStorage(
	options: LegacyCleanupOptions = {}
): Promise<LegacyCleanupResult> {
	const databases = options.databases ?? LEGACY_INDEXEDDB_DATABASES;
	const factory = options.indexedDBFactory ?? getDefaultIndexedDBFactory();
	const localStorageStore = options.localStorageStore ?? getDefaultLocalStorage();
	const result: LegacyCleanupResult = {
		deletedDatabases: [],
		failedDatabases: [],
		removedLocalStorageKeys: [],
		skippedIndexedDB: !factory
	};

	if (localStorageStore) {
		for (const key of getLocalStorageKeys(options)) {
			try {
				localStorageStore.removeItem(key);
				result.removedLocalStorageKeys.push(key);
			} catch {
				// Continue deleting other legacy data. Browser storage cleanup is best effort.
			}
		}
	}

	if (!factory) {
		return result;
	}

	for (const database of databases) {
		try {
			await deleteDatabase(factory, database);
			result.deletedDatabases.push(database);
		} catch (error) {
			result.failedDatabases.push({
				name: database,
				error: getErrorMessage(error)
			});
		}
	}

	return result;
}
