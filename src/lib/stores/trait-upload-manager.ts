/**
 * Manages async trait file uploads with status tracking.
 * Extracted from project store to isolate upload lifecycle and enable status queries.
 */

import { SvelteMap } from 'svelte/reactivity';
import type { TraitId } from '$lib/types/ids';
import { createTraitId } from '$lib/types/ids';
import type { Layer, Trait } from '$lib/types/project';
import { fileToArrayBuffer } from '$lib/utils';
import { globalResourceManager } from './resource-manager';

export type UploadStatus = 'pending' | 'loaded' | 'failed' | 'unknown';

interface PendingUpload {
	trait: Trait;
	layer: Layer;
	file: File;
}

interface UploadPromiseHandlers {
	resolve: () => void;
	reject: (error: Error) => void;
}

const BATCH_DELAY_MS = 100;

export class TraitUploadManager {
	private pendingUploads = new SvelteMap<TraitId, PendingUpload>();
	private promiseHandlers = new SvelteMap<TraitId, UploadPromiseHandlers>();
	private uploadStatuses = new SvelteMap<TraitId, UploadStatus>();
	private batchTimeoutId: ReturnType<typeof setTimeout> | null = null;

	uploadTrait(layerId: string, layer: Layer, file: File, traitName: string): Promise<TraitId> {
		const newTrait: Trait = {
			id: createTraitId(crypto.randomUUID()),
			name: traitName,
			imageData: new ArrayBuffer(0),
			rarityWeight: 5
		};

		layer.traits.push(newTrait);

		const loadPromise = new Promise<TraitId>((resolve, reject) => {
			this.promiseHandlers.set(newTrait.id, {
				resolve: () => resolve(newTrait.id),
				reject
			});
		});

		this.pendingUploads.set(newTrait.id, { trait: newTrait, layer, file });
		this.uploadStatuses.set(newTrait.id, 'pending');
		this.scheduleBatchUpdate();

		return loadPromise;
	}

	getUploadStatus(traitId: TraitId): UploadStatus {
		return this.uploadStatuses.get(traitId) ?? 'unknown';
	}

	pendingCount(): number {
		return this.pendingUploads.size;
	}

	private scheduleBatchUpdate(): void {
		if (this.batchTimeoutId) clearTimeout(this.batchTimeoutId);
		this.batchTimeoutId = setTimeout(() => {
			this.processPendingUploads();
			this.batchTimeoutId = null;
		}, BATCH_DELAY_MS);
	}

	private async processPendingUploads(): Promise<void> {
		if (this.pendingUploads.size === 0) return;

		const uploads = Array.from(this.pendingUploads.values());
		this.pendingUploads.clear();

		const results = await Promise.all(
			uploads.map(async ({ trait, layer, file }) => {
				try {
					const arrayBuffer = await fileToArrayBuffer(file);
					trait.imageData = arrayBuffer;
					const blob = new Blob([arrayBuffer], { type: file.type || 'image/png' });
					trait.imageUrl = URL.createObjectURL(blob);
					globalResourceManager.addObjectUrl(trait.imageUrl);
					this.uploadStatuses.set(trait.id, 'loaded');
					this.promiseHandlers.get(trait.id)?.resolve();
					this.promiseHandlers.delete(trait.id);
					return { trait, layer };
				} catch (error) {
					const traitIndex = layer.traits.findIndex((t) => t.id === trait.id);
					if (traitIndex !== -1) layer.traits.splice(traitIndex, 1);
					this.uploadStatuses.set(trait.id, 'failed');
					this.promiseHandlers.get(trait.id)?.reject(error as Error);
					this.promiseHandlers.delete(trait.id);
					return null;
				}
			})
		);

		const validResults = results.filter((r): r is { trait: Trait; layer: Layer } => r !== null);
		for (const { trait, layer } of validResults) {
			const traitIndex = layer.traits.findIndex((t) => t.id === trait.id);
			if (traitIndex !== -1) layer.traits[traitIndex] = trait;
		}
	}
}

export const traitUploadManager = new TraitUploadManager();
