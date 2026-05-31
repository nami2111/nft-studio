import type { GalleryCollection } from '$lib/types/gallery';
import type { Project } from '$lib/types/project';

export type MigrationStatus = 'not-started' | 'running' | 'completed' | 'failed';

export interface MigrationCounts {
	projectCount: number;
	layerCount: number;
	traitCount: number;
	traitBytes: number;
	galleryCollectionCount: number;
	galleryItemCount: number;
	galleryImageBytes: number;
}

export interface MigrationManifest {
	id: string;
	status: MigrationStatus;
	startedAt?: number;
	completedAt?: number;
	failedAt?: number;
	attempts: number;
	error?: string;
	counts: MigrationCounts;
}

export interface MigrationResult {
	id: string;
	status: MigrationStatus;
	skipped: boolean;
	manifest: MigrationManifest;
}

export interface LegacyMigrationReader {
	readProject(): Promise<Project | null>;
	readGalleryCollections(): Promise<GalleryCollection[]>;
	readGalleryItemImage(itemId: string): Promise<ArrayBuffer | null>;
}
