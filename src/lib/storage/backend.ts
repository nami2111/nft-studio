import { getStorageCapabilities } from './capabilities';
import { createIndexedDbLegacyStorageBackend } from './indexeddb-legacy';
import { createOpfsStorageBackend } from './opfs';
import type { ObjectStorageBackend } from './types';

let testingBackend: ObjectStorageBackend | null = null;
let opfsBackend: ObjectStorageBackend | null = null;
let legacyBackend: ObjectStorageBackend | null = null;

export function setStorageBackendForTesting(backend: ObjectStorageBackend | null): void {
	testingBackend = backend;
}

export async function getStorageBackend(): Promise<ObjectStorageBackend> {
	if (testingBackend) {
		return testingBackend;
	}

	const capabilities = getStorageCapabilities();

	if (capabilities.opfs) {
		opfsBackend ??= createOpfsStorageBackend();

		if (await opfsBackend.available()) {
			return opfsBackend;
		}
	}

	legacyBackend ??= createIndexedDbLegacyStorageBackend();
	return legacyBackend;
}

export async function getStorageBackendKind(): Promise<ObjectStorageBackend['kind']> {
	return (await getStorageBackend()).kind;
}
