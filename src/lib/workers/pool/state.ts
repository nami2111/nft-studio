import type { PoolForwardedWorkerMessage } from '$lib/types/worker-messages';
import type { WorkerPool } from './types';

// Global worker pool instance
export let workerPool: WorkerPool | null = null;

export function setWorkerPool(pool: WorkerPool | null): void {
	workerPool = pool;
}

// Callback for forwarding messages to clients
export let messageCallback: ((data: PoolForwardedWorkerMessage) => void) | null = null;

// Set message callback for client components to receive worker messages
export function setMessageCallback(callback: (data: PoolForwardedWorkerMessage) => void): void {
	messageCallback = callback;
}

export function debugLog(...args: unknown[]): void {
	if (import.meta.env.DEV) console.log('[worker.pool]', ...args);
}

/**
 * Get device capabilities to determine optimal worker count
 */
export function getDeviceCapabilities(): {
	coreCount: number;
	memoryGB: number;
	isMobile: boolean;
} {
	const coreCount = navigator.hardwareConcurrency || 4;
	let memoryGB = 8;
	if ('deviceMemory' in navigator) {
		// @ts-expect-error - deviceMemory not in all browsers
		memoryGB = navigator.deviceMemory || 8;
	}
	const isMobile = /Mobi|Android/i.test(navigator.userAgent);
	return { coreCount, memoryGB, isMobile };
}
