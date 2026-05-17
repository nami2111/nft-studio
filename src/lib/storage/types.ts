export interface StorageCapabilities {
	opfs: boolean;
	estimate: boolean;
	persist: boolean;
	persistedQuery: boolean;
	secureContext: boolean;
}

export interface BrowserStorageEstimate {
	usage: number;
	quota: number;
	usageDetails?: Record<string, number>;
}

export interface BinaryObjectStore {
	write(path: string, data: ArrayBuffer): Promise<void>;
	read(path: string): Promise<ArrayBuffer | null>;
	exists(path: string): Promise<boolean>;
	remove(path: string): Promise<void>;
	removeTree(path: string): Promise<void>;
	list(path: string): Promise<string[]>;
	size(path: string): Promise<number>;
}

export interface JsonObjectStore {
	writeJson<T>(path: string, value: T): Promise<void>;
	readJson<T>(path: string): Promise<T | null>;
	removeJson(path: string): Promise<void>;
}

export type StorageBackendKind = 'opfs' | 'indexeddb-legacy' | 'memory';

export interface ObjectStorageBackend {
	kind: StorageBackendKind;
	binary: BinaryObjectStore;
	json: JsonObjectStore;
	available(): Promise<boolean>;
}

export class StorageUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StorageUnavailableError';
	}
}
