/**
 * Session Cleanup Utility
 * Clears all user data on browser tab close/refresh for privacy and storage management
 */

import { globalResourceManager } from '$lib/stores/resource-manager';
import { SmartStorageStore } from '$lib/persistence/storage';

const LOCAL_STORAGE_KEYS = ['gnstudio-project', 'gnstudio-gallery-selected-collection'];

const PROJECT_STORAGE_KEY = 'gnstudio-project';

let cleanupPerformed = false;

export function setupSessionCleanup(): void {
	if (typeof window === 'undefined') return;

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
		clearLocalStorage();
		await clearIndexedDB();
		clearResourceManager();
	} catch (error) {
		console.warn('Session cleanup encountered an error:', error);
	}
}

function clearLocalStorage(): void {
	try {
		for (const key of LOCAL_STORAGE_KEYS) {
			localStorage.removeItem(key);
		}

		const storage = new SmartStorageStore<unknown>(PROJECT_STORAGE_KEY);
		storage.clear();
	} catch (error) {
		console.warn('Failed to clear localStorage:', error);
	}
}

async function clearIndexedDB(): Promise<void> {
	// Gallery data is persisted across sessions via IndexedDB.
	// Other IndexedDB cleanup can be added here if needed in the future.
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
