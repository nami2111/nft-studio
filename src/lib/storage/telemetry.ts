import { productionMonitor } from '$lib/utils/performance-monitor';
import { logger } from '$lib/utils/logger';
import type { BrowserStorageEstimate, StorageBackendKind, StorageCapabilities } from './types';

export async function measureStorageOperation<T>(
	operation: string,
	callback: () => Promise<T>
): Promise<T> {
	const start = performance.now();

	try {
		return await callback();
	} finally {
		productionMonitor.recordDatabaseQuery(`storage.${operation}`, performance.now() - start);
	}
}

export function logStorageDebugSummary(summary: {
	backend: StorageBackendKind;
	capabilities: StorageCapabilities;
	estimate: BrowserStorageEstimate;
	persisted: boolean;
	migrationStatus?: string;
}): void {
	logger.debug('Storage summary', summary);
}
