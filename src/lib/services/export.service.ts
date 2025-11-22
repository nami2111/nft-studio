import { trackGenerationCompleted } from '$lib/utils/analytics';
import type { Project } from '$lib/types/project';

export interface ExportOptions {
	project: Project;
	images: { name: string; imageData: ArrayBuffer }[];
	metadata: { name: string; data: Record<string, unknown> }[];
	startTime?: number;
	onProgress?: (progress: { processed: number; total: number; message: string }) => void;
}

export class ExportService {
	/**
	 * Package files into a ZIP with memory-efficient batch processing
	 */
	static async packageZip(options: ExportOptions): Promise<void> {
		const { project, images, metadata, startTime, onProgress } = options;

		try {
			// Use optimized approach for large collections
			if (images.length > 1000) {
				await this.packageZipOptimized({ project, images, metadata, onProgress });
			} else {
				await this.packageZipStandard({ project, images, metadata, onProgress });
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

	/**
	 * Standard ZIP creation for smaller collections (≤1000 files)
	 */
	private static async packageZipStandard(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		// Dynamically import JSZip to reduce initial bundle size
		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		// Add files with progress tracking
		for (let i = 0; i < images.length; i++) {
			imagesFolder?.file(images[i].name, images[i].imageData);
			onProgress?.({
				processed: i + 2,
				total: images.length + metadata.length + 1,
				message: `Adding images to ZIP (${i + 1}/${images.length})...`
			});
		}

		for (let i = 0; i < metadata.length; i++) {
			metadataFolder?.file(metadata[i].name, JSON.stringify(metadata[i].data, null, 2));
			onProgress?.({
				processed: images.length + i + 2,
				total: images.length + metadata.length + 1,
				message: `Adding metadata to ZIP (${i + 1}/${metadata.length})...`
			});
		}

		const content = await zip.generateAsync({ type: 'blob' });
		await this.downloadZip(content, project);
	}

	/**
	 * Optimized ZIP creation for larger collections with better memory management
	 */
	private static async packageZipOptimized(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		// For very large collections, create multiple smaller ZIPs
		if (images.length > 5000) {
			await this.createMultipleZips(options);
			return;
		}

		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		// Process in smaller chunks to manage memory
		const chunkSize = 250;

		for (let i = 0; i < images.length; i += chunkSize) {
			const chunk = images.slice(i, i + chunkSize);
			chunk.forEach((file) => {
				imagesFolder?.file(file.name, file.imageData);
			});

			// Trigger garbage collection hint
			if (i % (chunkSize * 4) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			onProgress?.({
				processed: i + chunk.length,
				total: images.length + metadata.length + 1,
				message: `Processing images (${i + chunk.length}/${images.length})...`
			});
		}

		for (let i = 0; i < metadata.length; i += chunkSize) {
			const chunk = metadata.slice(i, i + chunkSize);
			chunk.forEach((meta) => {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			});

			// Trigger garbage collection hint
			if (i % (chunkSize * 4) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			onProgress?.({
				processed: images.length + i + chunk.length,
				total: images.length + metadata.length + 1,
				message: `Processing metadata (${i + chunk.length}/${metadata.length})...`
			});
		}

		const content = await zip.generateAsync({ type: 'blob' });
		await this.downloadZip(content, project);
	}

	/**
	 * Create multiple smaller ZIP files for very large collections
	 */
	private static async createMultipleZips(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		const batchSize = 1000;
		const imageBatches = Math.ceil(images.length / batchSize);
		const metadataBatches = Math.ceil(metadata.length / batchSize);
		const totalBatches = imageBatches + metadataBatches;

		const { default: JSZip } = await import('jszip');

		// Create image ZIP batches
		for (let i = 0; i < imageBatches; i++) {
			const batchImages = images.slice(i * batchSize, (i + 1) * batchSize);
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');

			batchImages.forEach((file) => {
				imagesFolder?.file(file.name, file.imageData);
			});

			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${project.name || 'collection'}_images_part_${i + 1}_of_${imageBatches}.zip`;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			onProgress?.({
				processed: i + 1,
				total: totalBatches,
				message: `Created ZIP part ${i + 1}/${imageBatches} for images`
			});
		}

		// Create metadata ZIP batches
		for (let i = 0; i < metadataBatches; i++) {
			const batchMetadata = metadata.slice(i * batchSize, (i + 1) * batchSize);
			const zip = new JSZip();
			const metadataFolder = zip.folder('metadata');

			batchMetadata.forEach((meta) => {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			});

			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${project.name || 'collection'}_metadata_part_${i + 1}_of_${metadataBatches}.zip`;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			onProgress?.({
				processed: imageBatches + i + 1,
				total: totalBatches,
				message: `Created ZIP part ${i + 1}/${metadataBatches} for metadata`
			});
		}

		// Show summary message
		console.log(`Created ${totalBatches} ZIP files for large collection`);
	}

	/**
	 * Handle ZIP download with error handling
	 */
	private static async downloadZip(content: Blob, project: Project): Promise<void> {
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
	}
}
