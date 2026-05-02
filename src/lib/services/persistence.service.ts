/**
 * Persistence Service
 * Coordinates project storage across LocalStorage and IndexedDB
 * Implements differential persistence to optimize saving large projects
 */

import { IndexedDbStore, SmartStorageStore } from "$lib/persistence/storage";
import type { Project } from "$lib/types/project";
import { logger } from "$lib/utils/logger";

const METADATA_KEY = "gnstudio-project-metadata";
const LAYER_ASSETS_PREFIX = "gnstudio-layer-assets-";
const LEGACY_STORAGE_KEY = "gnstudio-project";

export class PersistenceService {
	private metaStorage = new SmartStorageStore<Record<string, unknown>>(
		METADATA_KEY,
	);
	private assetStorages = new Map<
		string,
		IndexedDbStore<{
			layerId: string;
			traits: { id: string; imageData: ArrayBuffer }[];
		}>
	>();
	private persistTimeout: ReturnType<typeof setTimeout> | null = null;
	private lastSavedMetadata: string | null = null;

	/**
	 * Get or create an IndexedDbStore for a specific layer's assets
	 */
	private getAssetStorage(layerId: string): IndexedDbStore<{
		layerId: string;
		traits: { id: string; imageData: ArrayBuffer }[];
	}> {
		const key = `${LAYER_ASSETS_PREFIX}${layerId}`;
		if (!this.assetStorages.has(key)) {
			this.assetStorages.set(key, new IndexedDbStore(key));
		}
		return this.assetStorages.get(key)!;
	}

	/**
	 * Persist project data with debouncing
	 */
	schedulePersist(project: Project, delay = 1000): void {
		if (this.persistTimeout) {
			clearTimeout(this.persistTimeout);
		}
		this.persistTimeout = setTimeout(() => {
			this.saveProject(project);
			this.persistTimeout = null;
		}, delay);
	}

	/**
	 * Save project to optimal storage using differential updates
	 */
	async saveProject(project: Project): Promise<void> {
		try {
			// 1. Prepare and save metadata (sans image data)
			const skeleton = this.createProjectSkeleton(project);
			const metadataJson = JSON.stringify(skeleton);

			if (metadataJson !== this.lastSavedMetadata) {
				await this.metaStorage.save(skeleton);
				this.lastSavedMetadata = metadataJson;
			}

			// 2. Save assets for each layer
			// In a more advanced version, we'd track which layers are dirty
			// For now, we save all layers but IndexedDB is efficient
			const assetPromises = project.layers.map(async (layer) => {
				const assets = {
					layerId: layer.id,
					traits: layer.traits.map((t) => ({
						id: t.id,
						imageData: t.imageData,
					})),
				};
				await this.getAssetStorage(layer.id).save(assets);
			});

			await Promise.all(assetPromises);
		} catch (error) {
			logger.error("Failed to persist project:", error);
		}
	}

	/**
	 * Load project from storage, reconciling metadata and assets
	 */
	async loadProject(): Promise<Project | null> {
		try {
			// Try new storage first
			const skeleton = await this.metaStorage.load();

			// Migration path for legacy data
			if (!skeleton) {
				const legacyData = await new SmartStorageStore<Project>(
					LEGACY_STORAGE_KEY,
				).load();
				if (legacyData) {
					logger.info("Migrating legacy project data to differential storage");
					await this.saveProject(legacyData);
					// Optionally clear legacy data after successful save
					// await new SmartStorageStore(LEGACY_STORAGE_KEY).clear();
					return legacyData;
				}
				return null;
			}

			// Reconstitute the project from metadata skeleton by hydrating image data.
			// skeleton is a Record<string, unknown> from IndexedDB; cast needed for hydration.
			const project = skeleton as unknown as Project;

			const assetPromises = project.layers.map(async (layer) => {
				const assets = await this.getAssetStorage(layer.id).load();
				if (assets && assets.traits) {
					assets.traits.forEach(
						(assetTrait: { id: string; imageData: ArrayBuffer }) => {
							const trait = layer.traits.find((t) => t.id === assetTrait.id);
							if (trait) {
								trait.imageData = assetTrait.imageData;
							}
						},
					);
				}
			});

			await Promise.all(assetPromises);
			return project;
		} catch (error) {
			logger.error("Failed to load project:", error);
			return null;
		}
	}

	/**
	 * Clear all persisted project data
	 */
	async clearData(): Promise<void> {
		try {
			await this.metaStorage.clear();
			// Clear all known asset storages
			const keys = Array.from(this.assetStorages.keys());
			await Promise.all(keys.map((k) => this.assetStorages.get(k)!.clear()));
			this.assetStorages.clear();

			// Also clear legacy if present
			localStorage.removeItem(LEGACY_STORAGE_KEY);
			localStorage.removeItem(METADATA_KEY);
			this.lastSavedMetadata = null;
		} catch (error) {
			logger.error("Failed to clear persisted project:", error);
		}
	}

	/**
	 * Check if any project data exists
	 */
	hasData(): boolean {
		return (
			localStorage.getItem(METADATA_KEY) !== null ||
			localStorage.getItem(LEGACY_STORAGE_KEY) !== null
		);
	}

	/**
	 * Load project metadata synchronously from LocalStorage (fallback for fast boot)
	 */
	loadMetadataSync(): Project | null {
		// Try new metadata first
		const data = localStorage.getItem(METADATA_KEY);
		if (data) {
			try {
				return JSON.parse(data);
			} catch {
				return null;
			}
		}

		// Fallback to legacy
		const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacy) {
			try {
				return JSON.parse(legacy);
			} catch {
				return null;
			}
		}

		return null;
	}

	/**
	 * Force immediate persistence of the project
	 */
	async flush(project: Project): Promise<void> {
		if (this.persistTimeout) {
			clearTimeout(this.persistTimeout);
			this.persistTimeout = null;
		}
		await this.saveProject(project);
	}

	/**
	 * Create a project skeleton with empty image data for metadata storage
	 */
	private createProjectSkeleton(project: Project): Record<string, unknown> {
		return {
			...project,
			layers: project.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => ({
					...trait,
					imageData: new ArrayBuffer(0), // Strip heavy data
					imageUrl: undefined, // URLs shouldn't be persisted
				})),
			})),
		};
	}
}

export const persistenceService = new PersistenceService();
