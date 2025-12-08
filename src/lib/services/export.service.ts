import { trackGenerationCompleted } from '$lib/utils/analytics';
import { MemoryMonitor } from '$lib/utils/memory-monitor';
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
			// Start memory monitoring for large exports
			if (images.length > 500) {
				MemoryMonitor.start();
			}

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
		} finally {
			// Stop memory monitoring
			MemoryMonitor.stop();
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

		// For very large collections or collections with large files, create multiple ZIPs
		if (images.length > 3000 || (images.length > 0 && images[0].imageData.byteLength > 500000)) {
			await this.createMultipleZips(options);
			return;
		}

		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		// Process in smaller chunks to manage memory
		const chunkSize = 100; // Reduced from 250 for better memory management

		for (let i = 0; i < images.length; i += chunkSize) {
			const chunk = images.slice(i, i + chunkSize);
			chunk.forEach((file) => {
				imagesFolder?.file(file.name, file.imageData);
			});

			// Clear references and trigger garbage collection
			chunk.length = 0;
			if (i % (chunkSize * 2) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
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

			// Clear references and trigger garbage collection
			chunk.length = 0;
			if (i % (chunkSize * 2) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			onProgress?.({
				processed: images.length + i + chunk.length,
				total: images.length + metadata.length + 1,
				message: `Processing metadata (${i + chunk.length}/${metadata.length})...`
			});
		}

		// Generate ZIP with optimized settings
		const content = await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});
		await this.downloadZip(content, project);
	}

	/**
	 * Create multiple smaller ZIP files for very large collections based on size (2GB max per ZIP)
	 */
	private static async createMultipleZips(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		const { default: JSZip } = await import('jszip');
		const MAX_ZIP_SIZE = 1 * 1024 * 1024 * 1024; // 1GB in bytes

		// Calculate approximate size for each NFT (image + metadata)
		const estimatedSizePerNFT = this.estimateSizePerNFT(images, metadata);
		const estimatedTotalSize = images.length * estimatedSizePerNFT;

		// Calculate number of ZIP files needed based on size
		const estimatedZipCount = Math.ceil(estimatedTotalSize / MAX_ZIP_SIZE);

		console.log(`Estimated total collection size: ${(estimatedTotalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
		console.log(`Will create approximately ${estimatedZipCount} ZIP files`);

		let currentZip = new JSZip();
		let currentZipImages = currentZip.folder('images');
		let currentZipMetadata = currentZip.folder('metadata');
		let currentZipSize = 0;
		let currentZipIndex = 0;
		let processedItems = 0;

		// Process all items
		for (let i = 0; i < images.length; i++) {
			const image = images[i];
			const meta = metadata[i];

			// Calculate size of current items
			const imageSize = image.imageData.byteLength;
			const metadataSize = new Blob([JSON.stringify(meta.data, null, 2)]).size;
			const itemTotalSize = imageSize + metadataSize;

			// Check if adding this item would exceed the 1GB limit
			if (currentZipSize + itemTotalSize > MAX_ZIP_SIZE && currentZipSize > 0) {
				// Finish current ZIP and start a new one
				const content = await currentZip.generateAsync({
					type: 'blob',
					compression: 'DEFLATE',
					compressionOptions: { level: 6 }
				});

				// Download current ZIP
				const zipIndex = currentZipIndex + 1;
				const totalZips = Math.ceil(images.length / Math.max(1, processedItems)) || 1;
				await this.downloadZipWithIndex(content, project, zipIndex, totalZips);

				// Reset for next ZIP
				currentZip = new JSZip();
				currentZipImages = currentZip.folder('images');
				currentZipMetadata = currentZip.folder('metadata');
				currentZipSize = 0;
				currentZipIndex++;
				processedItems = 0;
			}

			// Add image and metadata to current ZIP
			currentZipImages?.file(image.name, image.imageData);
			currentZipMetadata?.file(meta.name, JSON.stringify(meta.data, null, 2));
			currentZipSize += itemTotalSize;
			processedItems++;

			onProgress?.({
				processed: i + 1,
				total: images.length,
				message: `Processing NFT ${i + 1}/${images.length}...`
			});
		}

		// Don't forget the last ZIP file
		if (currentZipSize > 0) {
			const content = await currentZip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: { level: 6 }
			});

			const zipIndex = currentZipIndex + 1;
			await this.downloadZipWithIndex(content, project, zipIndex, zipIndex);
		}

		// Show summary message
		console.log(`Created ${currentZipIndex + 1} ZIP files for large collection`);
	}

	/**
	 * Estimate the average size per NFT (image + metadata)
	 */
	private static estimateSizePerNFT(images: { imageData: ArrayBuffer }[], metadata: { data: Record<string, unknown> }[]): number {
		// Sample the first 10 items to estimate average size
		const sampleSize = Math.min(10, images.length);
		let totalSize = 0;

		for (let i = 0; i < sampleSize; i++) {
			const imageSize = images[i]?.imageData?.byteLength || 0;
			const metadataSize = new Blob([JSON.stringify(metadata[i]?.data || {}, null, 2)]).size;
			totalSize += imageSize + metadataSize;
		}

		// Return average size per NFT
		return totalSize / sampleSize || 1; // Default to 1 byte if no data
	}

	/**
	 * Download ZIP file with index in filename
	 */
	private static async downloadZipWithIndex(content: Blob, project: Project, index: number, total: number): Promise<void> {
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${project.name || 'collection'}_part_${index}_of_${total}.zip`;

		document.body.appendChild(a);
		try {
			a.click();
			console.log(`Download initiated for part ${index} of ${total}`);
		} catch (error) {
			console.error(`Download failed for part ${index}:`, error);
			throw error;
		} finally {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
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
