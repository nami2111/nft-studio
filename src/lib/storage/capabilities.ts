import type { BrowserStorageEstimate, StorageCapabilities } from './types';

type StorageManagerWithOpfs = StorageManager & {
	getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

type StorageEstimateWithDetails = StorageEstimate & {
	usageDetails?: Record<string, number>;
};

export type StoragePersistenceReason = 'project-save' | 'gallery-import' | 'generation-session';

export type StoragePressureStatus = 'ok' | 'low' | 'insufficient' | 'unknown';

export interface StoragePressureReport {
	status: StoragePressureStatus;
	estimate: BrowserStorageEstimate;
	bytesNeeded: number;
	bytesNeededWithHeadroom: number;
	availableBytes: number;
	usageRatio: number;
}

export interface StoragePressureOptions {
	headroomMultiplier?: number;
	lowAvailableRatio?: number;
}

const DEFAULT_STORAGE_HEADROOM_MULTIPLIER = 1.5;
const DEFAULT_LOW_AVAILABLE_RATIO = 0.1;

const persistenceAttempts = new Map<StoragePersistenceReason, Promise<boolean>>();
const completedPersistenceResults = new Map<StoragePersistenceReason, boolean>();

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

export async function requestPersistentStorageOnce(
	reason: StoragePersistenceReason
): Promise<boolean> {
	const completedResult = completedPersistenceResults.get(reason);
	if (completedResult !== undefined) {
		return completedResult;
	}

	const pendingAttempt = persistenceAttempts.get(reason);
	if (pendingAttempt) {
		return pendingAttempt;
	}

	const attempt = (async () => {
		let result = false;
		try {
			if (await isPersistentStorageGranted()) {
				result = true;
				return result;
			}

			result = await requestPersistentStorage();
			return result;
		} finally {
			completedPersistenceResults.set(reason, result);
			persistenceAttempts.delete(reason);
		}
	})();

	persistenceAttempts.set(reason, attempt);
	return attempt;
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

export async function getStoragePressure(
	bytesNeeded: number,
	options: StoragePressureOptions = {}
): Promise<StoragePressureReport> {
	const estimate = await getStorageEstimate();
	const safeBytesNeeded = Number.isFinite(bytesNeeded) ? Math.max(0, bytesNeeded) : 0;
	const headroomMultiplier = Math.max(
		1,
		options.headroomMultiplier ?? DEFAULT_STORAGE_HEADROOM_MULTIPLIER
	);
	const lowAvailableRatio = Math.max(0, options.lowAvailableRatio ?? DEFAULT_LOW_AVAILABLE_RATIO);
	const bytesNeededWithHeadroom = safeBytesNeeded * headroomMultiplier;
	const availableBytes = Math.max(0, estimate.quota - estimate.usage);
	const usageRatio = estimate.quota > 0 ? estimate.usage / estimate.quota : 0;

	if (estimate.quota <= 0) {
		return {
			status: 'unknown',
			estimate,
			bytesNeeded: safeBytesNeeded,
			bytesNeededWithHeadroom,
			availableBytes: 0,
			usageRatio: 0
		};
	}

	let status: StoragePressureStatus = 'ok';
	if (availableBytes < safeBytesNeeded) {
		status = 'insufficient';
	} else if (
		availableBytes < bytesNeededWithHeadroom ||
		availableBytes / estimate.quota < lowAvailableRatio
	) {
		status = 'low';
	}

	return {
		status,
		estimate,
		bytesNeeded: safeBytesNeeded,
		bytesNeededWithHeadroom,
		availableBytes,
		usageRatio
	};
}

export function formatStorageBytes(bytes: number): string {
	const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = safeBytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
	return `${value.toFixed(decimals)}${units[unitIndex]}`;
}

export function resetStoragePersistenceRequestCacheForTesting(): void {
	persistenceAttempts.clear();
	completedPersistenceResults.clear();
}
