import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { setStorageBackendForTesting } from '$lib/storage/backend';
import { createMemoryStorageBackend } from '$lib/storage/memory';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import { cleanupAllData, resetCleanupFlag } from './session-cleanup';

function buffer(bytes: number): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

describe('session cleanup', () => {
	let backend: ObjectStorageBackend;

	beforeEach(() => {
		localStorage.clear();
		resetCleanupFlag();
		backend = createMemoryStorageBackend();
		setStorageBackendForTesting(backend);
	});

	afterEach(() => {
		setStorageBackendForTesting(null);
		resetCleanupFlag();
		localStorage.clear();
	});

	it('clears temporary generation sessions while preserving durable app data', async () => {
		localStorage.setItem('gnstudio-project', '{"id":"project-1"}');
		localStorage.setItem('gnstudio-gallery-selected-collection', 'collection-1');

		await backend.json.writeJson(storagePaths.projectManifest(), { id: 'project-1' });
		await backend.json.writeJson(storagePaths.galleryIndex(), {
			collectionIds: ['collection-1'],
			updatedAt: 1
		});
		await backend.json.writeJson(storagePaths.generationSessionManifest('session-1'), {
			sessionId: 'session-1',
			createdAt: 1,
			updatedAt: 1,
			items: []
		});
		await backend.binary.write(storagePaths.generationImage('session-1', 0), buffer(1));

		await cleanupAllData();

		expect(
			await backend.json.readJson(storagePaths.generationSessionManifest('session-1'))
		).toBeNull();
		expect(await backend.binary.exists(storagePaths.generationImage('session-1', 0))).toBe(false);
		expect(await backend.json.readJson(storagePaths.projectManifest())).toEqual({
			id: 'project-1'
		});
		expect(await backend.json.readJson(storagePaths.galleryIndex())).toEqual({
			collectionIds: ['collection-1'],
			updatedAt: 1
		});
		expect(localStorage.getItem('gnstudio-project')).toBe('{"id":"project-1"}');
		expect(localStorage.getItem('gnstudio-gallery-selected-collection')).toBe('collection-1');
	});
});
