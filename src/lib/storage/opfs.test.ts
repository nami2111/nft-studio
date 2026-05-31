import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createOpfsStorageBackend } from './opfs';

type StorageManagerWithOpfs = Partial<StorageManager> & {
	getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

const originalStorage = navigator.storage;

function mockStorage(storage: StorageManagerWithOpfs): void {
	Object.defineProperty(navigator, 'storage', {
		configurable: true,
		value: storage
	});
}

function createDirectoryHandle(
	existingFiles: Set<string>,
	fileHandle: FileSystemFileHandle
): FileSystemDirectoryHandle & {
	getDirectoryHandle: ReturnType<typeof vi.fn>;
	getFileHandle: ReturnType<typeof vi.fn>;
} {
	const directory = {
		getDirectoryHandle: vi.fn(async () => directory),
		getFileHandle: vi.fn(async (name: string) => {
			if (!existingFiles.has(name)) {
				throw new DOMException('File not found', 'NotFoundError');
			}

			return fileHandle;
		})
	};

	return directory as unknown as FileSystemDirectoryHandle & {
		getDirectoryHandle: ReturnType<typeof vi.fn>;
		getFileHandle: ReturnType<typeof vi.fn>;
	};
}

describe('OPFS storage adapter', () => {
	afterEach(() => {
		Object.defineProperty(navigator, 'storage', {
			configurable: true,
			value: originalStorage
		});
	});

	it('checks binary existence without reading the file payload', async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(4));
		const getFile = vi.fn(async () => ({ arrayBuffer }) as unknown as File);
		const fileHandle = { getFile } as unknown as FileSystemFileHandle;
		const root = createDirectoryHandle(new Set(['asset.bin']), fileHandle);

		mockStorage({
			getDirectory: vi.fn(async () => root)
		});

		const backend = createOpfsStorageBackend();

		await expect(
			backend.binary.exists('gnstudio/projects/current/layers/layer-1/asset.bin')
		).resolves.toBe(true);
		await expect(
			backend.binary.exists('gnstudio/projects/current/layers/layer-1/missing.bin')
		).resolves.toBe(false);

		expect(getFile).not.toHaveBeenCalled();
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});
