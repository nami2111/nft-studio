import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	formatStorageBytes,
	getStoragePressure,
	requestPersistentStorageOnce,
	resetStoragePersistenceRequestCacheForTesting
} from './capabilities';

const originalStorage = navigator.storage;

function mockStorage(storage: Partial<StorageManager>): void {
	Object.defineProperty(navigator, 'storage', {
		configurable: true,
		value: storage
	});
}

describe('storage capabilities', () => {
	afterEach(() => {
		resetStoragePersistenceRequestCacheForTesting();
		Object.defineProperty(navigator, 'storage', {
			configurable: true,
			value: originalStorage
		});
	});

	it('requests persistent storage once per reason', async () => {
		const persist = vi.fn().mockResolvedValue(true);
		const persisted = vi.fn().mockResolvedValue(false);
		mockStorage({ persist, persisted });

		await requestPersistentStorageOnce('project-save');
		await requestPersistentStorageOnce('project-save');
		await requestPersistentStorageOnce('gallery-import');

		expect(persist).toHaveBeenCalledTimes(2);
		expect(persisted).toHaveBeenCalledTimes(2);
	});

	it('does not request persistence when it is already granted', async () => {
		const persist = vi.fn().mockResolvedValue(true);
		const persisted = vi.fn().mockResolvedValue(true);
		mockStorage({ persist, persisted });

		await requestPersistentStorageOnce('generation-session');

		expect(persist).not.toHaveBeenCalled();
		expect(persisted).toHaveBeenCalledOnce();
	});

	it('reports storage pressure using centralized quota estimates', async () => {
		mockStorage({
			estimate: vi.fn().mockResolvedValue({
				usage: 92,
				quota: 100
			})
		});

		await expect(getStoragePressure(5)).resolves.toMatchObject({
			status: 'low',
			bytesNeeded: 5,
			availableBytes: 8
		});
		await expect(getStoragePressure(30)).resolves.toMatchObject({
			status: 'insufficient',
			bytesNeeded: 30,
			availableBytes: 8
		});
	});

	it('formats storage byte values for warning copy', () => {
		expect(formatStorageBytes(0)).toBe('0B');
		expect(formatStorageBytes(1024)).toBe('1.0KB');
		expect(formatStorageBytes(5 * 1024 * 1024)).toBe('5.0MB');
		expect(formatStorageBytes(15 * 1024 * 1024)).toBe('15MB');
	});
});
