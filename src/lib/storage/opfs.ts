import { sanitizeStorageSegment } from './paths';
import { StorageUnavailableError, type ObjectStorageBackend } from './types';

type StorageManagerWithOpfs = StorageManager & {
	getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
	entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

function getStorageManager(): StorageManagerWithOpfs | null {
	if (typeof navigator === 'undefined' || !navigator.storage) {
		return null;
	}

	return navigator.storage as StorageManagerWithOpfs;
}

function isNotFoundError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'NotFoundError';
}

function splitPath(path: string): string[] {
	return path.split('/').map(sanitizeStorageSegment);
}

async function getRootDirectory(): Promise<FileSystemDirectoryHandle> {
	const storage = getStorageManager();

	if (typeof storage?.getDirectory !== 'function') {
		throw new StorageUnavailableError('OPFS is not available in this browser.');
	}

	return storage.getDirectory();
}

async function getDirectoryHandle(
	segments: string[],
	create: boolean
): Promise<FileSystemDirectoryHandle> {
	let directory = await getRootDirectory();

	for (const segment of segments) {
		directory = await directory.getDirectoryHandle(segment, { create });
	}

	return directory;
}

async function getParentDirectory(
	path: string,
	create: boolean
): Promise<{ directory: FileSystemDirectoryHandle; name: string }> {
	const segments = splitPath(path);
	const name = segments.pop();

	if (!name) {
		throw new Error(`Storage path must include a file or directory name: ${path}`);
	}

	return {
		directory: await getDirectoryHandle(segments, create),
		name
	};
}

class OpfsBinaryObjectStore {
	async write(path: string, data: ArrayBuffer): Promise<void> {
		const { directory, name } = await getParentDirectory(path, true);
		const fileHandle = await directory.getFileHandle(name, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(data);
		await writable.close();
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		try {
			const { directory, name } = await getParentDirectory(path, false);
			const fileHandle = await directory.getFileHandle(name, { create: false });
			const file = await fileHandle.getFile();
			return await file.arrayBuffer();
		} catch (error) {
			if (isNotFoundError(error)) return null;
			throw error;
		}
	}

	async exists(path: string): Promise<boolean> {
		return (await this.read(path)) !== null;
	}

	async remove(path: string): Promise<void> {
		try {
			const { directory, name } = await getParentDirectory(path, false);
			await directory.removeEntry(name);
		} catch (error) {
			if (!isNotFoundError(error)) throw error;
		}
	}

	async removeTree(path: string): Promise<void> {
		try {
			const { directory, name } = await getParentDirectory(path, false);
			await directory.removeEntry(name, { recursive: true });
		} catch (error) {
			if (!isNotFoundError(error)) throw error;
		}
	}

	async list(path: string): Promise<string[]> {
		try {
			const directory = (await getDirectoryHandle(
				splitPath(path),
				false
			)) as IterableDirectoryHandle;
			const names: string[] = [];

			for await (const [name] of directory.entries()) {
				names.push(name);
			}

			return names.sort();
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async size(path: string): Promise<number> {
		try {
			const { directory, name } = await getParentDirectory(path, false);
			const fileHandle = await directory.getFileHandle(name, { create: false });
			const file = await fileHandle.getFile();
			return file.size;
		} catch (error) {
			if (isNotFoundError(error)) return 0;
			throw error;
		}
	}
}

class OpfsJsonObjectStore {
	constructor(private binary: OpfsBinaryObjectStore) {}

	async writeJson<T>(path: string, value: T): Promise<void> {
		const bytes = new TextEncoder().encode(JSON.stringify(value));
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		await this.binary.write(path, buffer);
	}

	async readJson<T>(path: string): Promise<T | null> {
		const buffer = await this.binary.read(path);
		if (!buffer) return null;

		const text = new TextDecoder().decode(buffer);
		return JSON.parse(text) as T;
	}

	async removeJson(path: string): Promise<void> {
		await this.binary.remove(path);
	}
}

export function createOpfsStorageBackend(): ObjectStorageBackend {
	const binary = new OpfsBinaryObjectStore();

	return {
		kind: 'opfs',
		binary,
		json: new OpfsJsonObjectStore(binary),
		available: async () => typeof getStorageManager()?.getDirectory === 'function'
	};
}
