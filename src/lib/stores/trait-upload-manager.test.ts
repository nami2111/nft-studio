import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TraitUploadManager } from './trait-upload-manager';
import { unsafeCreateLayerId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Layer } from '$lib/types/project';
import * as utils from '$lib/utils';

vi.mock('$lib/utils', () => ({
	fileToArrayBuffer: vi.fn()
}));

vi.mock('./resource-manager', () => ({
	globalResourceManager: {
		addObjectUrl: vi.fn(),
		removeObjectUrl: vi.fn(),
		cleanup: vi.fn()
	}
}));

describe('TraitUploadManager', () => {
	let manager: TraitUploadManager;
	let mockLayer: Layer;

	beforeEach(() => {
		manager = new TraitUploadManager();
		mockLayer = {
			id: unsafeCreateLayerId('layer-1'),
			name: 'Test Layer',
			order: 0,
			traits: []
		};
		vi.clearAllMocks();
		global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('uploadTrait', () => {
		it('creates trait with pending status', async () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(new ArrayBuffer(4));

			const promise = manager.uploadTrait('layer-1', mockLayer, file, 'test');

			expect(mockLayer.traits).toHaveLength(1);
			expect(mockLayer.traits[0].name).toBe('test');
			expect(manager.getUploadStatus(mockLayer.traits[0].id)).toBe('pending');
			expect(manager.pendingCount()).toBe(1);

			await promise;
		});

		it('transitions to loaded status on success', async () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			const mockBuffer = new ArrayBuffer(4);
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(mockBuffer);

			const traitId = await manager.uploadTrait('layer-1', mockLayer, file, 'test');

			await vi.waitFor(() => {
				expect(manager.getUploadStatus(traitId)).toBe('loaded');
			});

			expect(manager.pendingCount()).toBe(0);
			expect(mockLayer.traits[0].imageData).toBe(mockBuffer);
			expect(mockLayer.traits[0].imageUrl).toMatch(/^blob:/);
		});

		it('transitions to failed status on error', async () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockRejectedValue(new Error('Read failed'));

			const promise = manager.uploadTrait('layer-1', mockLayer, file, 'test');
			const traitId = mockLayer.traits[0].id;

			await expect(promise).rejects.toThrow('Read failed');

			await vi.waitFor(() => {
				expect(manager.getUploadStatus(traitId)).toBe('failed');
			});

			expect(manager.pendingCount()).toBe(0);
			expect(mockLayer.traits).toHaveLength(0);
		});

		it('batches multiple uploads', async () => {
			const file1 = new File(['test1'], 'test1.png', { type: 'image/png' });
			const file2 = new File(['test2'], 'test2.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(new ArrayBuffer(4));

			const promise1 = manager.uploadTrait('layer-1', mockLayer, file1, 'test1');
			const promise2 = manager.uploadTrait('layer-1', mockLayer, file2, 'test2');

			expect(manager.pendingCount()).toBe(2);

			await Promise.all([promise1, promise2]);

			expect(manager.pendingCount()).toBe(0);
			expect(mockLayer.traits).toHaveLength(2);
		});
	});

	describe('getUploadStatus', () => {
		it('returns unknown for non-existent trait', () => {
			const traitId = unsafeCreateTraitId('unknown');
			expect(manager.getUploadStatus(traitId)).toBe('unknown');
		});

		it('tracks status through lifecycle', async () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(new ArrayBuffer(4));

			const promise = manager.uploadTrait('layer-1', mockLayer, file, 'test');
			const traitId = mockLayer.traits[0].id;

			expect(manager.getUploadStatus(traitId)).toBe('pending');

			await promise;

			expect(manager.getUploadStatus(traitId)).toBe('loaded');
		});
	});

	describe('pendingCount', () => {
		it('returns 0 initially', () => {
			expect(manager.pendingCount()).toBe(0);
		});

		it('increments with uploads', () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(new ArrayBuffer(4));

			manager.uploadTrait('layer-1', mockLayer, file, 'test1');
			expect(manager.pendingCount()).toBe(1);

			manager.uploadTrait('layer-1', mockLayer, file, 'test2');
			expect(manager.pendingCount()).toBe(2);
		});

		it('decrements after processing', async () => {
			const file = new File(['test'], 'test.png', { type: 'image/png' });
			vi.mocked(utils.fileToArrayBuffer).mockResolvedValue(new ArrayBuffer(4));

			const promise = manager.uploadTrait('layer-1', mockLayer, file, 'test');
			expect(manager.pendingCount()).toBe(1);

			await promise;

			await vi.waitFor(() => {
				expect(manager.pendingCount()).toBe(0);
			});
		});
	});
});
