import { galleryStore } from '$lib/stores/gallery.store.svelte';
import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
import { trackGenerationCompleted } from '$lib/utils/analytics';
import type { Layer } from '$lib/types/layer';
import type { Project } from '$lib/types/project';

export interface ExportOptions {
	project: Project;
	images: { name: string; imageData: ArrayBuffer }[];
	metadata: { name: string; data: Record<string, unknown> }[];
	startTime?: number;
}

export class ExportService {
	static async packageZip(options: ExportOptions): Promise<void> {
		const { project, images, metadata, startTime } = options;

		try {
			// Save to gallery first
			try {
				console.log('Saving generated NFTs to gallery...');

				// Convert images and metadata to gallery format
				const galleryNFTs = images.map((image, index) => {
					const matchingMetadata = metadata.find((meta) => meta.name === image.name);
					return {
						name: image.name.replace('.png', ''),
						imageData: image.imageData,
						metadata: matchingMetadata?.data || { traits: [] },
						index
					};
				});

				// Import into gallery store
				const collection = galleryStore.importGeneratedNFTs(
					galleryNFTs,
					project.name || 'Untitled Collection',
					project.description || 'Generated NFT collection'
				);

				// Calculate rarity for the collection
				const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
				galleryStore.updateCollection(collection.id, updatedCollection);

				console.log(`Saved ${galleryNFTs.length} NFTs to gallery collection: ${collection.name}`);
			} catch (galleryError) {
				console.error('Failed to save to gallery:', galleryError);
				// Don't let gallery errors prevent the download
			}

			// Dynamically import JSZip to reduce initial bundle size
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');
			const metadataFolder = zip.folder('metadata');

			for (const file of images) {
				imagesFolder?.file(file.name, file.imageData);
			}
			for (const meta of metadata) {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			}

			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${project.name || 'collection'}.zip`;

			// Try programmatic download
			document.body.appendChild(a);
			try {
				a.click();
				console.log('Download initiated for:', a.download);
			} catch (error) {
				console.error('Download failed:', error);
				throw error;
			} finally {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}

			// Track generation completion analytics
			if (startTime) {
				const durationSeconds = Math.round((Date.now() - startTime) / 1000);
				trackGenerationCompleted(images.length, durationSeconds);
			}
		} catch (error) {
			console.error('Export failed:', error);
			throw error;
		}
	}
}
