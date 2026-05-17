const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._=-]+$/;

export function sanitizeStorageSegment(segment: string): string {
	if (!segment || segment === '.' || segment === '..') {
		throw new Error(`Invalid storage path segment: ${segment}`);
	}

	if (segment.includes('/') || segment.includes('\\') || !SAFE_SEGMENT_PATTERN.test(segment)) {
		throw new Error(`Unsafe storage path segment: ${segment}`);
	}

	return segment;
}

export function joinStoragePath(...segments: string[]): string {
	return segments.map(sanitizeStorageSegment).join('/');
}

export const storagePaths = {
	root: 'gnstudio',
	storageVersion: () => joinStoragePath('gnstudio', 'storage-version.json'),
	projectManifest: () => joinStoragePath('gnstudio', 'projects', 'current', 'project.json'),
	projectTraitAsset: (layerId: string, traitId: string) =>
		joinStoragePath('gnstudio', 'projects', 'current', 'layers', layerId, `${traitId}.bin`),
	galleryIndex: () => joinStoragePath('gnstudio', 'gallery', 'index.json'),
	galleryCollectionManifest: (collectionId: string) =>
		joinStoragePath('gnstudio', 'gallery', 'collections', collectionId, 'collection.json'),
	galleryItemImage: (collectionId: string, itemId: string) =>
		joinStoragePath('gnstudio', 'gallery', 'collections', collectionId, 'items', `${itemId}.bin`),
	generationSessionManifest: (sessionId: string) =>
		joinStoragePath('gnstudio', 'generation', sessionId, 'manifest.json'),
	generationImage: (sessionId: string, index: number) =>
		joinStoragePath('gnstudio', 'generation', sessionId, 'images', `${index}.bin`),
	generationMetadata: (sessionId: string, index: number) =>
		joinStoragePath('gnstudio', 'generation', sessionId, 'metadata', `${index}.json`),
	generationSessionRoot: (sessionId: string) =>
		joinStoragePath('gnstudio', 'generation', sessionId),
	migrationManifest: (migrationId: string) =>
		joinStoragePath('gnstudio', 'migrations', `${migrationId}.json`)
};
