import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { setStorageBackendForTesting } from '$lib/storage/backend';
import { createMemoryStorageBackend } from '$lib/storage/memory';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import { unsafeCreateLayerId, unsafeCreateProjectId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Project } from '$lib/types/project';
import { PersistenceService } from './persistence.service';
import { saveProjectToZip } from '../stores/file-operations';

function buffer(values: number[]): ArrayBuffer {
	return new Uint8Array(values).buffer;
}

function bytes(data: ArrayBuffer | null): number[] | null {
	return data ? Array.from(new Uint8Array(data)) : null;
}

function createProject(): Project {
	return {
		id: unsafeCreateProjectId('project-1'),
		name: 'Project One',
		description: 'Stored project',
		outputSize: { width: 512, height: 512 },
		layers: [
			{
				id: unsafeCreateLayerId('layer-1'),
				name: 'Background',
				order: 0,
				traits: [
					{
						id: unsafeCreateTraitId('trait-1'),
						name: 'Blue',
						imageData: buffer([1, 2, 3]),
						imageUrl: 'blob:stale-url',
						rarityWeight: 5
					},
					{
						id: unsafeCreateTraitId('trait-2'),
						name: 'Red',
						imageData: buffer([4, 5]),
						imageUrl: 'blob:stale-url-2',
						rarityWeight: 3
					}
				]
			},
			{
				id: unsafeCreateLayerId('layer-2'),
				name: 'Eyes',
				order: 1,
				traits: [
					{
						id: unsafeCreateTraitId('trait-3'),
						name: 'Open',
						imageData: buffer([6, 7, 8, 9]),
						rarityWeight: 4
					}
				]
			}
		],
		_needsProperLoad: false
	};
}

describe('PersistenceService object storage', () => {
	let backend: ObjectStorageBackend;
	let originalWorker: typeof Worker;

	beforeEach(() => {
		localStorage.clear();
		backend = createMemoryStorageBackend();
		setStorageBackendForTesting(backend);
		originalWorker = globalThis.Worker;
	});

	afterEach(() => {
		setStorageBackendForTesting(null);
		globalThis.Worker = originalWorker;
		localStorage.clear();
	});

	it('stores project metadata separately from trait image bytes', async () => {
		const service = new PersistenceService();
		const project = createProject();

		await service.saveProject(project);

		const manifest = await backend.json.readJson<{
			layers: Array<{ traits: Array<Record<string, unknown>> }>;
		}>(storagePaths.projectManifest());
		expect(manifest).not.toBeNull();
		expect(manifest?.layers[0].traits[0].imageData).toBeUndefined();
		expect(manifest?.layers[0].traits[0].imageUrl).toBeUndefined();
		expect(
			bytes(await backend.binary.read(storagePaths.projectTraitAsset('layer-1', 'trait-1')))
		).toEqual([1, 2, 3]);
		expect(
			bytes(await backend.binary.read(storagePaths.projectTraitAsset('layer-2', 'trait-3')))
		).toEqual([6, 7, 8, 9]);
		expect(service.hasData()).toBe(true);
		expect(await service.hasDataAsync()).toBe(true);
	});

	it('hydrates trait buffers from object storage without restoring stale object URLs', async () => {
		const service = new PersistenceService();
		await service.saveProject(createProject());

		const reloadedService = new PersistenceService();
		const loadedProject = await reloadedService.loadProject();

		expect(loadedProject).not.toBeNull();
		expect(bytes(loadedProject?.layers[0].traits[0].imageData ?? null)).toEqual([1, 2, 3]);
		expect(bytes(loadedProject?.layers[1].traits[0].imageData ?? null)).toEqual([6, 7, 8, 9]);
		expect(loadedProject?.layers[0].traits[0].imageUrl).toBeUndefined();
	});

	it('removes stale trait files when a dirty layer is rewritten', async () => {
		const service = new PersistenceService();
		const project = createProject();
		await service.saveProject(project);

		project.layers[0].traits = [project.layers[0].traits[0]];
		service.markDirty(project.layers[0].id);
		await service.saveProject(project);

		expect(await backend.binary.exists(storagePaths.projectTraitAsset('layer-1', 'trait-1'))).toBe(
			true
		);
		expect(await backend.binary.exists(storagePaths.projectTraitAsset('layer-1', 'trait-2'))).toBe(
			false
		);
	});

	it('clears the full persisted project tree', async () => {
		const service = new PersistenceService();
		const project = createProject();
		await service.saveProject(project);

		expect(await backend.binary.exists(storagePaths.projectTraitAsset('layer-1', 'trait-1'))).toBe(
			true
		);

		await service.clearData();

		expect(await backend.json.readJson(storagePaths.projectManifest())).toBeNull();
		expect(await backend.binary.exists(storagePaths.projectTraitAsset('layer-1', 'trait-1'))).toBe(
			false
		);
		expect(service.hasData()).toBe(false);
		expect(await service.hasDataAsync()).toBe(false);
	});

	it('exports hydrated project images to the ZIP worker after loading from storage', async () => {
		const service = new PersistenceService();
		await service.saveProject(createProject());

		const loadedProject = await new PersistenceService().loadProject();
		const postedMessages: unknown[] = [];
		const terminate = vi.fn();

		class MockZipWorker {
			onmessage: ((event: MessageEvent) => void) | null = null;
			onerror: ((event: ErrorEvent) => void) | null = null;

			postMessage(message: unknown): void {
				postedMessages.push(message);
				queueMicrotask(() => {
					this.onmessage?.({
						data: {
							type: 'zip-complete',
							payload: {
								buffer: buffer([10, 11])
							}
						}
					} as MessageEvent);
				});
			}

			terminate(): void {
				terminate();
			}
		}

		globalThis.Worker = MockZipWorker as unknown as typeof Worker;

		const zipData = await saveProjectToZip(loadedProject!);
		const zipMessage = postedMessages[0] as {
			type: string;
			payload: {
				projectData: string;
				imageFiles: Array<{ path: string; data: ArrayBuffer }>;
			};
		};

		expect(bytes(zipData)).toEqual([10, 11]);
		expect(terminate).toHaveBeenCalledOnce();
		expect(zipMessage.type).toBe('zip-project');
		expect(zipMessage.payload.imageFiles).toHaveLength(3);
		expect(zipMessage.payload.imageFiles.map((file) => file.path)).toEqual([
			'images/layer-1/trait-1.png',
			'images/layer-1/trait-2.png',
			'images/layer-2/trait-3.png'
		]);
		expect(zipMessage.payload.imageFiles.map((file) => bytes(file.data))).toEqual([
			[1, 2, 3],
			[4, 5],
			[6, 7, 8, 9]
		]);
		expect(
			JSON.parse(zipMessage.payload.projectData).layers[0].traits[0].imageData
		).toBeUndefined();
	});
});
