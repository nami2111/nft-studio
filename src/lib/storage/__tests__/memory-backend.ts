import type { BinaryObjectStore, JsonObjectStore, ObjectStorageBackend } from '../types';

function cloneBuffer(data: ArrayBuffer): ArrayBuffer {
	return data.slice(0);
}

function cloneJson<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function isPathInTree(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

class MemoryObjectStore implements BinaryObjectStore, JsonObjectStore {
	private binaries = new Map<string, ArrayBuffer>();
	private jsonValues = new Map<string, unknown>();

	async write(path: string, data: ArrayBuffer): Promise<void> {
		this.binaries.set(path, cloneBuffer(data));
	}

	async read(path: string): Promise<ArrayBuffer | null> {
		const data = this.binaries.get(path);
		return data ? cloneBuffer(data) : null;
	}

	async exists(path: string): Promise<boolean> {
		return this.binaries.has(path) || this.jsonValues.has(path);
	}

	async remove(path: string): Promise<void> {
		this.binaries.delete(path);
		this.jsonValues.delete(path);
	}

	async removeTree(path: string): Promise<void> {
		for (const key of Array.from(this.binaries.keys())) {
			if (isPathInTree(key, path)) this.binaries.delete(key);
		}

		for (const key of Array.from(this.jsonValues.keys())) {
			if (isPathInTree(key, path)) this.jsonValues.delete(key);
		}
	}

	async list(path: string): Promise<string[]> {
		const prefix = path.endsWith('/') ? path : `${path}/`;
		const names = new Set<string>();

		for (const key of [...this.binaries.keys(), ...this.jsonValues.keys()]) {
			if (!key.startsWith(prefix)) continue;
			const child = key.slice(prefix.length).split('/')[0];
			if (child) names.add(child);
		}

		return Array.from(names).sort();
	}

	async size(path: string): Promise<number> {
		const data = this.binaries.get(path);
		if (data) return data.byteLength;

		if (!this.jsonValues.has(path)) return 0;
		return new Blob([JSON.stringify(this.jsonValues.get(path))]).size;
	}

	async writeJson<T>(path: string, value: T): Promise<void> {
		this.jsonValues.set(path, cloneJson(value));
	}

	async readJson<T>(path: string): Promise<T | null> {
		if (!this.jsonValues.has(path)) return null;
		return cloneJson(this.jsonValues.get(path) as T);
	}

	async removeJson(path: string): Promise<void> {
		this.jsonValues.delete(path);
	}
}

export function createMemoryStorageBackend(): ObjectStorageBackend {
	const store = new MemoryObjectStore();

	return {
		kind: 'memory',
		binary: store,
		json: store,
		available: async () => true
	};
}
