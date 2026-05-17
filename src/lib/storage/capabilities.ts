import type { BrowserStorageEstimate, StorageCapabilities } from './types';

type StorageManagerWithOpfs = StorageManager & {
	getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

type StorageEstimateWithDetails = StorageEstimate & {
	usageDetails?: Record<string, number>;
};

function getStorageManager(): StorageManagerWithOpfs | null {
	if (typeof navigator === 'undefined' || !navigator.storage) {
		return null;
	}

	return navigator.storage as StorageManagerWithOpfs;
}

function isSecureExecutionContext(): boolean {
	if (typeof globalThis === 'undefined' || !('isSecureContext' in globalThis)) {
		return false;
	}

	return Boolean((globalThis as { isSecureContext?: boolean }).isSecureContext);
}

export function getStorageCapabilities(): StorageCapabilities {
	const storage = getStorageManager();

	return {
		opfs: typeof storage?.getDirectory === 'function',
		estimate: typeof storage?.estimate === 'function',
		persist: typeof storage?.persist === 'function',
		persistedQuery: typeof storage?.persisted === 'function',
		secureContext: isSecureExecutionContext()
	};
}

export async function getStorageEstimate(): Promise<BrowserStorageEstimate> {
	const storage = getStorageManager();

	if (typeof storage?.estimate !== 'function') {
		return { usage: 0, quota: 0 };
	}

	const estimate = (await storage.estimate()) as StorageEstimateWithDetails;
	return {
		usage: estimate.usage || 0,
		quota: estimate.quota || 0,
		usageDetails: estimate.usageDetails
	};
}

export async function requestPersistentStorage(): Promise<boolean> {
	const storage = getStorageManager();

	if (typeof storage?.persist !== 'function') {
		return false;
	}

	try {
		return await storage.persist();
	} catch {
		return false;
	}
}

export async function isPersistentStorageGranted(): Promise<boolean> {
	const storage = getStorageManager();

	if (typeof storage?.persisted !== 'function') {
		return false;
	}

	try {
		return await storage.persisted();
	} catch {
		return false;
	}
}
