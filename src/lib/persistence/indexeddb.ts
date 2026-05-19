// Legacy project storage wrapper retained for OPFS migration fallback.
// Provides a simple CRUD interface around a single "current" project entry.
import type { Project } from '$lib/types/project';

export async function openLegacyProjectDatabase(): Promise<IDBDatabase> {
	if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
		// In non-browser environments legacy project storage is not available.
		return Promise.reject(
			new Error('Legacy project storage is not available in this environment.')
		);
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('gnstudio', 1);
		request.onupgradeneeded = () => {
			const db = request.result as IDBDatabase;
			if (!db.objectStoreNames.contains('projects')) {
				db.createObjectStore('projects', { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result as IDBDatabase);
		request.onerror = () => reject(request.error);
	});
}

export function saveProjectToLegacyStorage(projectData: Project): Promise<void> {
	return openLegacyProjectDatabase()
		.then((db) => {
			return new Promise<void>((resolve, reject) => {
				const tx = db.transaction('projects', 'readwrite');
				const store = tx.objectStore('projects');
				const payload = { id: 'current', data: projectData, timestamp: Date.now() };
				const req = store.put(payload);
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
			});
		})
		.catch((error) => {
			console.error('Failed to save project to legacy project storage:', error);
			// Re-throw the error so it can be handled by the caller
			throw new Error(
				`Failed to save project to legacy project storage: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		});
}

export function loadProjectFromLegacyStorage(): Promise<Project | null> {
	return openLegacyProjectDatabase()
		.then((db) => {
			return new Promise<Project | null>((resolve, reject) => {
				const tx = db.transaction('projects', 'readonly');
				const store = tx.objectStore('projects');
				const req = store.get('current');
				req.onsuccess = () => {
					const result = req.result;
					resolve(result && result.data ? result.data : null);
				};
				req.onerror = () => reject(req.error);
			});
		})
		.catch((error) => {
			console.error('Failed to load project from legacy project storage:', error);
			// Return null to indicate no project was loaded, but don't throw
			return null;
		});
}

export function deleteLegacyProject(): Promise<void> {
	return openLegacyProjectDatabase()
		.then((db) => {
			return new Promise<void>((resolve, reject) => {
				const tx = db.transaction('projects', 'readwrite');
				const store = tx.objectStore('projects');
				const req = store.delete('current');
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
			});
		})
		.catch((error) => {
			console.error('Failed to delete project from legacy project storage:', error);
			// Resolve the promise to indicate the operation is complete, even if it failed
			return Promise.resolve();
		});
}
