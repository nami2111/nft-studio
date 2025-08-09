// Lightweight IndexedDB persistence wrapper for NFT Studio
// Provides a simple CRUD interface around a single "current" project entry.

export async function openDatabase(): Promise<IDBDatabase> {
	if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
		// In non-browser environments IndexedDB isn't available
		return Promise.reject(new Error('IndexedDB is not available in this environment.'));
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('nft-studio', 1);
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

export function saveProjectToIndexedDB(projectData: any): Promise<void> {
	return openDatabase().then((db) => {
		return new Promise<void>((resolve, reject) => {
			const tx = db.transaction('projects', 'readwrite');
			const store = tx.objectStore('projects');
			const payload = { id: 'current', data: projectData, timestamp: Date.now() };
			const req = store.put(payload);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	}).catch((error) => {
		console.error('Failed to save project to IndexedDB:', error);
		// Re-throw the error so it can be handled by the caller
		throw new Error(`Failed to save project to IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
	});
}

export function loadProjectFromIndexedDB(): Promise<any | null> {
	return openDatabase()
		.then((db) => {
			return new Promise<any | null>((resolve, reject) => {
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
			console.error('Failed to load project from IndexedDB:', error);
			// Return null to indicate no project was loaded, but don't throw
			return null;
		});
}

export function deleteIndexedProject(): Promise<void> {
	return openDatabase()
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
			console.error('Failed to delete project from IndexedDB:', error);
			// Resolve the promise to indicate the operation is complete, even if it failed
			return Promise.resolve();
		});
}
