/**
 * Persistence Service
 * Coordinates project storage across OPFS and legacy browser storage.
 * Implements differential persistence to optimize saving large projects.
 */

import { deleteLegacyProject, loadProjectFromLegacyStorage } from '$lib/persistence/indexeddb';
import { LegacyIndexedDbStore, SmartStorageStore } from '$lib/persistence/storage';
import { getStorageBackend } from '$lib/storage/backend';
import { requestPersistentStorageOnce } from '$lib/storage/capabilities';
import { runIndexedDbToOpfsMigration } from '$lib/storage/migrations';
import { storagePaths } from '$lib/storage/paths';
import type { ObjectStorageBackend } from '$lib/storage/types';
import type { Layer, Project, Trait } from '$lib/types/project';
import { logger } from '$lib/utils/logger';

const METADATA_KEY = 'gnstudio-project-metadata';
const LAYER_ASSETS_PREFIX = 'gnstudio-layer-assets-';
const LEGACY_STORAGE_KEY = 'gnstudio-project';
const PROJECT_BOOT_HINT_KEY = 'gnstudio-project-boot-hint';
const LEGACY_ASSETS_DB_NAME = 'gnstudio-assets';
const LEGACY_ASSETS_STORE_NAME = 'store';

interface LegacyLayerAssets {
	layerId: string;
	traits: { id: string; imageData: ArrayBuffer }[];
}

type StoredProjectTrait = Omit<Trait, 'imageData' | 'imageUrl'> & {
	imageData?: never;
	imageUrl?: never;
};

type StoredProjectLayer = Omit<Layer, 'traits'> & {
	traits: StoredProjectTrait[];
};

type StoredProjectManifest = Omit<Project, 'layers'> & {
	layers: StoredProjectLayer[];
};

interface ProjectBootHint {
	projectId: string;
	projectName: string;
	updatedAt: number;
}

type LayerSaveTarget = { layer: Layer } | { missingLayerId: string };

async function getProjectStorageBackend(): Promise<ObjectStorageBackend | null> {
	const backend = await getStorageBackend();
	return backend.kind === 'indexeddb-legacy' ? null : backend;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
	return value instanceof ArrayBuffer;
}

export class PersistenceService {
	private metaStorage = new SmartStorageStore<StoredProjectManifest>(METADATA_KEY);
	private persistTimeout: ReturnType<typeof setTimeout> | null = null;
	private lastSavedMetadata: string | null = null;
	private dirtyMetadata = false;
	private dirtyLayers = new Set<string>();

	/**
	 * Get a legacy browser database-backed store for a specific layer's assets.
	 */
	private getLegacyAssetStorage(layerId: string): LegacyIndexedDbStore<LegacyLayerAssets> {
		return new LegacyIndexedDbStore<LegacyLayerAssets>(`${LAYER_ASSETS_PREFIX}${layerId}`);
	}

	/**
	 * Mark metadata or a specific layer as dirty so the next save will write it.
	 */
	markDirty(layerId?: string): void {
		if (layerId) {
			this.dirtyLayers.add(layerId);
		} else {
			this.dirtyMetadata = true;
		}
	}

	/**
	 * Persist project data with debouncing.
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
	 * Save project to the active storage path using differential updates.
	 */
	async saveProject(project: Project): Promise<void> {
		try {
			const backend = await getProjectStorageBackend();

			if (backend) {
				await this.saveProjectToObjectStorage(backend, project);
				return;
			}

			await this.saveProjectToLegacyStorage(project);
		} catch (error) {
			logger.error('Failed to persist project:', error);
		}
	}

	/**
	 * Load project from storage, preferring OPFS and falling back to legacy data.
	 */
	async loadProject(): Promise<Project | null> {
		try {
			const backend = await getProjectStorageBackend();

			if (backend) {
				await runIndexedDbToOpfsMigration().catch((error) => {
					logger.warn('Legacy storage to OPFS migration failed; using fallback readers', error);
				});

				const storedProject = await this.loadProjectFromObjectStorage(backend);
				if (storedProject) {
					return storedProject;
				}

				const legacyProject = await this.loadProjectFromLegacyStorage();
				if (legacyProject) {
					logger.info('Migrating legacy project data to object storage');
					await this.saveProjectToObjectStorage(backend, legacyProject, {
						forceFullAssetWrite: true
					});
					return legacyProject;
				}

				return null;
			}

			return await this.loadProjectFromLegacyStorage();
		} catch (error) {
			logger.error('Failed to load project:', error);
			return null;
		}
	}

	/**
	 * Clear all persisted project data.
	 */
	async clearData(): Promise<void> {
		try {
			const backend = await getProjectStorageBackend();

			if (backend) {
				await backend.binary.removeTree(storagePaths.projectRoot());
			}

			this.clearProjectBootHint();

			if (typeof indexedDB !== 'undefined') {
				await Promise.all([this.clearLegacyIndexedDbKeys(), deleteLegacyProject()]);
			}

			this.lastSavedMetadata = null;
			this.dirtyMetadata = false;
			this.dirtyLayers.clear();
		} catch (error) {
			logger.error('Failed to clear persisted project:', error);
		}
	}

	/**
	 * Check if any synchronous project data hint exists.
	 */
	hasData(): boolean {
		if (typeof localStorage === 'undefined') {
			return false;
		}

		return (
			localStorage.getItem(PROJECT_BOOT_HINT_KEY) !== null ||
			localStorage.getItem(METADATA_KEY) !== null ||
			localStorage.getItem(LEGACY_STORAGE_KEY) !== null
		);
	}

	/**
	 * Check the async source of truth when OPFS is active.
	 */
	async hasDataAsync(): Promise<boolean> {
		const backend = await getProjectStorageBackend();

		if (backend && (await backend.binary.exists(storagePaths.projectManifest()))) {
			return true;
		}

		return this.hasData();
	}

	/**
	 * Load project metadata synchronously from localStorage for legacy fast boot.
	 */
	loadMetadataSync(): Project | null {
		if (typeof localStorage === 'undefined') {
			return null;
		}

		const data = localStorage.getItem(METADATA_KEY);
		if (data) {
			try {
				return this.normalizeProject(JSON.parse(data) as Project);
			} catch {
				return null;
			}
		}

		const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacy) {
			try {
				return this.normalizeProject(JSON.parse(legacy) as Project);
			} catch {
				return null;
			}
		}

		return null;
	}

	/**
	 * Force immediate persistence of the project.
	 */
	async flush(project: Project): Promise<void> {
		if (this.persistTimeout) {
			clearTimeout(this.persistTimeout);
			this.persistTimeout = null;
		}
		await this.saveProject(project);
	}

	private async saveProjectToObjectStorage(
		backend: ObjectStorageBackend,
		project: Project,
		options: { forceFullAssetWrite?: boolean } = {}
	): Promise<void> {
		const manifest = this.createProjectManifest(project);
		const manifestJson = JSON.stringify(manifest);
		const shouldSaveManifest =
			options.forceFullAssetWrite ||
			this.dirtyMetadata ||
			this.lastSavedMetadata === null ||
			manifestJson !== this.lastSavedMetadata;
		const layersToSave = this.getLayersToSave(project, manifestJson, options.forceFullAssetWrite);

		await Promise.all(
			layersToSave.map((target) =>
				'layer' in target
					? this.saveLayerAssetsToObjectStorage(backend, target.layer)
					: backend.binary.removeTree(storagePaths.projectLayerRoot(target.missingLayerId))
			)
		);

		if (shouldSaveManifest) {
			await this.removeStaleProjectLayersFromObjectStorage(backend, project);
			await backend.json.writeJson(storagePaths.projectManifest(), manifest);
			this.lastSavedMetadata = manifestJson;
			this.dirtyMetadata = false;
		}

		this.writeProjectBootHint(project);
		this.dirtyLayers.clear();
		void requestPersistentStorageOnce('project-save');
	}

	private async saveProjectToLegacyStorage(project: Project): Promise<void> {
		const manifest = this.createProjectManifest(project);
		const manifestJson = JSON.stringify(manifest);
		const shouldSaveManifest =
			this.dirtyMetadata ||
			this.lastSavedMetadata === null ||
			manifestJson !== this.lastSavedMetadata;
		const layersToSave = this.getLayersToSave(project, manifestJson);

		if (shouldSaveManifest) {
			await this.metaStorage.save(manifest);
			this.lastSavedMetadata = manifestJson;
			this.dirtyMetadata = false;
		}

		await Promise.all(
			layersToSave.map((target) =>
				'layer' in target ? this.saveLayerAssetsToLegacyStorage(target.layer) : Promise.resolve()
			)
		);
		this.dirtyLayers.clear();
	}

	private getLayersToSave(
		project: Project,
		manifestJson: string,
		forceFullAssetWrite = false
	): LayerSaveTarget[] {
		if (forceFullAssetWrite || this.lastSavedMetadata === null) {
			return project.layers.map((layer) => ({ layer }));
		}

		if (this.dirtyLayers.size > 0) {
			return Array.from(this.dirtyLayers).map((layerId): LayerSaveTarget => {
				const layer = project.layers.find((projectLayer) => projectLayer.id === layerId);
				return layer ? { layer } : { missingLayerId: layerId };
			});
		}

		if (!this.dirtyMetadata && manifestJson !== this.lastSavedMetadata) {
			return project.layers.map((layer) => ({ layer }));
		}

		return [];
	}

	private async saveLayerAssetsToObjectStorage(
		backend: ObjectStorageBackend,
		layer: Layer
	): Promise<void> {
		const traitIds = new Set(layer.traits.map((trait) => trait.id));

		await Promise.all(
			layer.traits.map(async (trait) => {
				const path = storagePaths.projectTraitAsset(layer.id, trait.id);

				if (isArrayBuffer(trait.imageData) && trait.imageData.byteLength > 0) {
					await backend.binary.write(path, trait.imageData);
					return;
				}

				await backend.binary.remove(path);
			})
		);

		await this.removeStaleLayerTraitAssetsFromObjectStorage(backend, layer.id, traitIds);
	}

	private async removeStaleLayerTraitAssetsFromObjectStorage(
		backend: ObjectStorageBackend,
		layerId: string,
		traitIds: Set<string>
	): Promise<void> {
		const fileNames = await backend.binary.list(storagePaths.projectLayerRoot(layerId));

		await Promise.all(
			fileNames.map(async (fileName) => {
				if (!fileName.endsWith('.bin')) return;

				const traitId = fileName.slice(0, -'.bin'.length);
				if (traitIds.has(traitId)) return;

				await backend.binary.remove(storagePaths.projectTraitAsset(layerId, traitId));
			})
		);
	}

	private async removeStaleProjectLayersFromObjectStorage(
		backend: ObjectStorageBackend,
		project: Project
	): Promise<void> {
		const layerIds = new Set<string>(project.layers.map((layer) => layer.id));
		const storedLayerIds = await backend.binary.list(storagePaths.projectLayersRoot());

		await Promise.all(
			storedLayerIds.map(async (layerId) => {
				if (layerIds.has(layerId)) return;
				await backend.binary.removeTree(storagePaths.projectLayerRoot(layerId));
			})
		);
	}

	private async saveLayerAssetsToLegacyStorage(layer: Layer): Promise<void> {
		await this.getLegacyAssetStorage(layer.id).save({
			layerId: layer.id,
			traits: layer.traits.map((trait) => ({
				id: trait.id,
				imageData: isArrayBuffer(trait.imageData) ? trait.imageData : new ArrayBuffer(0)
			}))
		});
	}

	private async loadProjectFromObjectStorage(
		backend: ObjectStorageBackend
	): Promise<Project | null> {
		const manifest = await backend.json.readJson<StoredProjectManifest>(
			storagePaths.projectManifest()
		);
		if (!manifest) return null;

		const project = this.hydrateProjectManifest(manifest);
		let legacyProject: Project | null | undefined;

		await Promise.all(
			project.layers.map(async (layer) => {
				let legacyLayerAssets: LegacyLayerAssets | null | undefined;

				await Promise.all(
					layer.traits.map(async (trait) => {
						const path = storagePaths.projectTraitAsset(layer.id, trait.id);
						const storedAsset = await backend.binary.read(path);
						if (storedAsset) {
							trait.imageData = storedAsset;
							return;
						}

						if (backend.kind !== 'opfs') return;

						legacyLayerAssets ??= await this.getLegacyAssetStorage(layer.id).load();
						const legacyAsset = legacyLayerAssets?.traits.find(
							(assetTrait) => assetTrait.id === trait.id
						);

						if (legacyAsset?.imageData && legacyAsset.imageData.byteLength > 0) {
							trait.imageData = legacyAsset.imageData;
							await backend.binary.write(path, legacyAsset.imageData);
							return;
						}

						legacyProject ??= await this.loadProjectFromLegacyStorage();
						const legacyLayer = legacyProject?.layers.find(
							(projectLayer) => projectLayer.id === layer.id
						);
						const legacyTrait = legacyLayer?.traits.find(
							(projectTrait) => projectTrait.id === trait.id
						);

						if (
							legacyTrait?.imageData instanceof ArrayBuffer &&
							legacyTrait.imageData.byteLength > 0
						) {
							trait.imageData = legacyTrait.imageData;
							await backend.binary.write(path, legacyTrait.imageData);
						}
					})
				);
			})
		);

		this.rememberSavedProject(project);
		return project;
	}

	private async loadProjectFromLegacyStorage(): Promise<Project | null> {
		const skeleton = await this.metaStorage.load();
		if (skeleton) {
			const project = this.hydrateProjectManifest(skeleton);
			await this.hydrateProjectFromLegacyLayerAssets(project);
			this.rememberSavedProject(project);
			return project;
		}

		const legacyData = await new SmartStorageStore<Project>(LEGACY_STORAGE_KEY).load();
		if (legacyData) {
			const project = this.normalizeProject(legacyData);
			this.rememberSavedProject(project);
			return project;
		}

		const indexedProject = await loadProjectFromLegacyStorage();
		if (indexedProject) {
			const project = this.normalizeProject(indexedProject);
			this.rememberSavedProject(project);
			return project;
		}

		return null;
	}

	private async hydrateProjectFromLegacyLayerAssets(project: Project): Promise<void> {
		await Promise.all(
			project.layers.map(async (layer) => {
				const assets = await this.getLegacyAssetStorage(layer.id).load();
				if (!assets?.traits) return;

				for (const assetTrait of assets.traits) {
					const trait = layer.traits.find((projectTrait) => projectTrait.id === assetTrait.id);
					if (!trait || !isArrayBuffer(assetTrait.imageData)) continue;
					trait.imageData = assetTrait.imageData;
				}
			})
		);
	}

	private createProjectManifest(project: Project): StoredProjectManifest {
		return {
			...project,
			layers: project.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => {
					const { imageData: _imageData, imageUrl: _imageUrl, ...storedTrait } = trait;
					return storedTrait;
				})
			}))
		};
	}

	private hydrateProjectManifest(manifest: StoredProjectManifest): Project {
		return this.normalizeProject({
			...manifest,
			layers: manifest.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => ({
					...trait,
					imageData: new ArrayBuffer(0)
				}))
			}))
		} as Project);
	}

	private normalizeProject(project: Project): Project {
		return {
			...project,
			layers: project.layers.map((layer) => ({
				...layer,
				traits: layer.traits.map((trait) => ({
					...trait,
					imageData: isArrayBuffer(trait.imageData) ? trait.imageData : new ArrayBuffer(0),
					imageUrl: undefined
				}))
			}))
		};
	}

	private rememberSavedProject(project: Project): void {
		this.lastSavedMetadata = JSON.stringify(this.createProjectManifest(project));
		this.dirtyMetadata = false;
		this.dirtyLayers.clear();
	}

	private writeProjectBootHint(project: Project): void {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.setItem(
				PROJECT_BOOT_HINT_KEY,
				JSON.stringify({
					projectId: project.id,
					projectName: project.name,
					updatedAt: Date.now()
				} satisfies ProjectBootHint)
			);
		} catch {
			// The hint is optional; OPFS remains the source of truth.
		}
	}

	private clearProjectBootHint(): void {
		if (typeof localStorage === 'undefined') return;

		try {
			localStorage.removeItem(PROJECT_BOOT_HINT_KEY);
			localStorage.removeItem(METADATA_KEY);
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		} catch {
			// Clearing storage should still succeed for the async backends.
		}
	}

	private clearLegacyIndexedDbKeys(): Promise<void> {
		if (typeof indexedDB === 'undefined') {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			const request = indexedDB.open(LEGACY_ASSETS_DB_NAME, 1);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(LEGACY_ASSETS_STORE_NAME)) {
					db.createObjectStore(LEGACY_ASSETS_STORE_NAME, { keyPath: 'key' });
				}
			};

			request.onerror = () => resolve();
			request.onblocked = () => resolve();
			request.onsuccess = () => {
				const db = request.result;

				if (!db.objectStoreNames.contains(LEGACY_ASSETS_STORE_NAME)) {
					db.close();
					resolve();
					return;
				}

				const tx = db.transaction([LEGACY_ASSETS_STORE_NAME], 'readwrite');
				const store = tx.objectStore(LEGACY_ASSETS_STORE_NAME);
				const keysRequest = store.getAllKeys();

				keysRequest.onerror = () => {
					db.close();
					resolve();
				};

				keysRequest.onsuccess = () => {
					for (const key of keysRequest.result) {
						if (
							typeof key === 'string' &&
							(key === METADATA_KEY ||
								key === LEGACY_STORAGE_KEY ||
								key.startsWith(LAYER_ASSETS_PREFIX))
						) {
							store.delete(key);
						}
					}
				};

				tx.oncomplete = () => {
					db.close();
					resolve();
				};
				tx.onerror = () => {
					db.close();
					resolve();
				};
			};
		});
	}
}

export const persistenceService = new PersistenceService();
