/**
 * Session Cleanup Utility
 * Clears temporary browser-session resources on tab close/refresh.
 */

import { globalResourceManager } from '$lib/stores/resource-manager';
import { cleanupStaleGenerationSessions } from './streaming-storage';

let cleanupPerformed = false;

export function setupSessionCleanup(): void {
	if (typeof window === 'undefined') return;

	void cleanupStaleGenerationSessions();
	window.addEventListener('beforeunload', handlePageUnload);
	window.addEventListener('pagehide', handlePageUnload);
}

export function removeSessionCleanup(): void {
	if (typeof window === 'undefined') return;

	window.removeEventListener('beforeunload', handlePageUnload);
	window.removeEventListener('pagehide', handlePageUnload);
}

async function handlePageUnload(): Promise<void> {
	if (cleanupPerformed) return;
	cleanupPerformed = true;

	await cleanupAllData();
}

export async function cleanupAllData(): Promise<void> {
	if (typeof window === 'undefined') return;

	try {
		await clearTemporaryGenerationSessions();
		clearResourceManager();
	} catch (error) {
		console.warn('Session cleanup encountered an error:', error);
	}
}

async function clearTemporaryGenerationSessions(): Promise<void> {
	await cleanupStaleGenerationSessions({ maxAgeMs: 0, preserveActiveWrites: false });
}

function clearResourceManager(): void {
	try {
		globalResourceManager.destroy();
	} catch (error) {
		console.warn('Failed to clear resource manager:', error);
	}
}

export function isCleanupPerformed(): boolean {
	return cleanupPerformed;
}

export function resetCleanupFlag(): void {
	cleanupPerformed = false;
}
