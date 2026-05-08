import type { Project } from '$lib/types/project';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { MemoryMonitor } from '$lib/utils/memory-monitor';
import { iterateImages, iterateMetadata, getImageCount } from '$lib/utils/streaming-storage';

export interface ExportOptions {
	project: Project;
	images: { name: string; imageData: ArrayBuffer }[];
	metadata: { name: string; data: Record<string, unknown> }[];
	startTime?: number;
	onProgress?: (progress: { processed: number; total: number; message: string }) => void;
	/** When set, images/metadata are pulled from IndexedDB instead of in-memory arrays. */
	sessionId?: string;
}

interface ZipWorkerMessage {
	type: 'zip-project';
	taskId: string;
	payload: {
		projectData: string;
		imageFiles: Array<{ path: string; data: ArrayBuffer }>;
	};
}

function runZipWorker(message: ZipWorkerMessage): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.postMessage(message);

		worker.onmessage = (e: MessageEvent) => {
			const data = e.data;
			if (data.type === 'zip-complete') {
				worker.terminate();
				resolve(data.payload.buffer as ArrayBuffer);
			} else if (data.type === 'zip-error') {
				worker.terminate();
				reject(new Error(data.payload?.error || 'ZIP worker error'));
			}
		};

		worker.onerror = (err) => {
			worker.terminate();
			reject(new Error(err.message || 'ZIP worker failed'));
		};
	});
}

type ImageEntry = { name: string; imageData: ArrayBuffer };
type MetadataEntry = { name: string; data: Record<string, unknown> };

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	try {
		a.click();
	} catch (error) {
		console.error('Download failed:', error);
		throw error;
	} finally {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}

export class ExportService {
	/**
	 * Package files into a ZIP with memory-efficient batch processing.
	 * When sessionId is provided, data is read from IndexedDB streaming storage.
	 */
	static async packageZip(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress, sessionId } = options;

		const streaming = isFlagEnabled('enableStreamingStorage') && !!sessionId;
		const totalItems = streaming
			? Math.max(images.length, await getImageCount(sessionId!))
			: images.length;

		// Use ZIP worker offloading when enabled and collection is large enough
		const useZipWorker = isFlagEnabled('enableZipWorkerOffloading') && totalItems > 500;

		try {
			if (totalItems > 500) {
				MemoryMonitor.start();
			}

			if (useZipWorker) {
				await ExportService.buildAndDownloadWithWorker({
					project,
					images,
					metadata,
					onProgress,
					sessionId
				});
				return;
			}

			if (totalItems > 1000) {
				await ExportService.buildAndDownloadOptimized({
					project,
					images,
					metadata,
					onProgress,
					sessionId
				});
			} else {
				await ExportService.buildAndDownloadStandard({
					project,
					images,
					metadata,
					onProgress,
					sessionId
				});
			}
		} catch (error) {
			console.error('Export failed:', error);
			throw error;
		} finally {
			MemoryMonitor.stop();
		}
	}

	/**
	 * Offload ZIP creation to a dedicated web worker.
	 */
	private static async buildAndDownloadWithWorker(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress, sessionId } = options;
		const streaming = isFlagEnabled('enableStreamingStorage') && !!sessionId;

		const imageFiles: Array<{ path: string; data: ArrayBuffer }> = [];

		if (streaming && sessionId) {
			await iterateImages(sessionId, async (batch) => {
				for (const img of batch) {
					imageFiles.push({ path: `images/${img.name}`, data: img.imageData });
				}
			});
			await iterateMetadata(sessionId, async (batch) => {
				for (const meta of batch) {
					const encoded = new TextEncoder().encode(JSON.stringify(meta.data, null, 2));
					imageFiles.push({
						path: `metadata/${meta.name}`,
						data: encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
					});
				}
			});
		} else {
			for (const img of images) {
				imageFiles.push({ path: `images/${img.name}`, data: img.imageData });
			}
			for (const meta of metadata) {
				const encoded = new TextEncoder().encode(JSON.stringify(meta.data, null, 2));
				imageFiles.push({
					path: `metadata/${meta.name}`,
					data: encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
				});
			}
		}

		onProgress?.({
			processed: 0,
			total: imageFiles.length,
			message: 'Offloading ZIP creation to worker...'
		});

		const projectData = JSON.stringify({
			name: project.name,
			description: project.description,
			outputSize: project.outputSize
		});

		const buffer = await runZipWorker({
			type: 'zip-project',
			taskId: `zip-${Date.now()}`,
			payload: {
				projectData,
				imageFiles
			}
		});

		const blob = new Blob([buffer], { type: 'application/zip' });
		downloadBlob(blob, `${project.name || 'collection'}.zip`);

		onProgress?.({
			processed: imageFiles.length,
			total: imageFiles.length,
			message: 'ZIP created and download started'
		});
	}

	/**
	 * Standard ZIP creation for smaller collections (≤1000 files)
	 */
	private static async buildAndDownloadStandard(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress, sessionId } = options;
		const streaming = isFlagEnabled('enableStreamingStorage') && !!sessionId;

		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		let processed = 0;

		if (streaming && sessionId) {
			await iterateImages(sessionId, async (batch) => {
				for (const img of batch) {
					imagesFolder?.file(img.name, img.imageData);
					processed++;
					onProgress?.({
						processed,
						total: images.length + metadata.length + 1,
						message: `Adding images to ZIP (${processed})...`
					});
				}
			});
			await iterateMetadata(sessionId, async (batch) => {
				for (const meta of batch) {
					metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
					processed++;
					onProgress?.({
						processed,
						total: images.length + metadata.length + 1,
						message: `Adding metadata to ZIP (${processed})...`
					});
				}
			});
		} else {
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
		}

		const content = await zip.generateAsync({ type: 'blob' });
		downloadBlob(content, `${project.name || 'collection'}.zip`);
	}

	/**
	 * Optimized ZIP creation for larger collections with better memory management.
	 * Falls back to multiple ZIPs when the collection is very large.
	 */
	private static async buildAndDownloadOptimized(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress, sessionId } = options;
		const streaming = isFlagEnabled('enableStreamingStorage') && !!sessionId;

		const totalItems = streaming
			? Math.max(images.length, await getImageCount(sessionId!))
			: images.length;

		// For very large collections, create multiple ZIPs
		if (totalItems > 3000 || (images.length > 0 && images[0]?.imageData.byteLength > 500000)) {
			await ExportService.buildAndDownloadMultiple(options);
			return;
		}

		const { default: JSZip } = await import('jszip');
		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		const chunkSize = 100;
		let processed = 0;

		if (streaming && sessionId) {
			await iterateImages(sessionId, async (batch) => {
				for (const img of batch) {
					imagesFolder?.file(img.name, img.imageData);
					processed++;
				}
				if (processed % (chunkSize * 2) === 0) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				onProgress?.({
					processed,
					total: totalItems,
					message: `Processing images (${processed}/${totalItems})...`
				});
			});
			await iterateMetadata(sessionId, async (batch) => {
				for (const meta of batch) {
					metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
					processed++;
				}
				if (processed % (chunkSize * 2) === 0) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				onProgress?.({
					processed,
					total: totalItems,
					message: `Processing metadata (${processed}/${totalItems})...`
				});
			});
		} else {
			for (let i = 0; i < images.length; i += chunkSize) {
				const chunk = images.slice(i, i + chunkSize);
				chunk.forEach((file) => {
					imagesFolder?.file(file.name, file.imageData);
				});
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
		}

		const content = await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});
		downloadBlob(content, `${project.name || 'collection'}.zip`);
	}

	/**
	 * Create multiple smaller ZIP files for very large collections (1GB max per ZIP).
	 */
	private static async buildAndDownloadMultiple(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress, sessionId } = options;
		const streaming = isFlagEnabled('enableStreamingStorage') && !!sessionId;

		const { default: JSZip } = await import('jszip');
		const MAX_ZIP_SIZE = 1 * 1024 * 1024 * 1024; // 1GB in bytes

		let currentZip = new JSZip();
		let currentZipImages = currentZip.folder('images');
		let currentZipMetadata = currentZip.folder('metadata');
		let currentZipSize = 0;
		let currentZipIndex = 0;
		let processedItems = 0;
		let totalProcessed = 0;

		const flushZip = async (): Promise<void> => {
			if (currentZipSize === 0) return;
			const content = await currentZip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: { level: 6 }
			});
			const zipIndex = currentZipIndex + 1;
			// total is unknown upfront for streaming; finalise later
			downloadBlob(content, `${project.name || 'collection'}_part_${zipIndex}_of_*.zip`);
			currentZip = new JSZip();
			currentZipImages = currentZip.folder('images');
			currentZipMetadata = currentZip.folder('metadata');
			currentZipSize = 0;
			currentZipIndex++;
			processedItems = 0;
		};

		const addItem = (image: ImageEntry, meta: MetadataEntry): boolean => {
			const imageSize = image.imageData.byteLength;
			const metadataSize = new Blob([JSON.stringify(meta.data, null, 2)]).size;
			const itemTotalSize = imageSize + metadataSize;

			if (currentZipSize + itemTotalSize > MAX_ZIP_SIZE && currentZipSize > 0) {
				return false; // signal caller to flush and retry
			}

			currentZipImages?.file(image.name, image.imageData);
			currentZipMetadata?.file(meta.name, JSON.stringify(meta.data, null, 2));
			currentZipSize += itemTotalSize;
			processedItems++;
			totalProcessed++;
			return true;
		};

		if (streaming && sessionId) {
			const metaMap = new Map<string, MetadataEntry>();
			await iterateMetadata(sessionId, async (batch) => {
				for (const meta of batch) {
					metaMap.set(meta.name, meta);
				}
			});
			await iterateImages(sessionId, async (batch) => {
				for (const img of batch) {
					const metaName = img.name.replace(/\.png$/i, '.json');
					const meta = metaMap.get(metaName) ?? {
						name: metaName,
						data: {}
					};
					if (!addItem(img, meta)) {
						await flushZip();
						addItem(img, meta);
					}
					onProgress?.({
						processed: totalProcessed,
						total: images.length,
						message: `Processing item ${totalProcessed}...`
					});
				}
			});
		} else {
			for (let i = 0; i < images.length; i++) {
				const image = images[i];
				const meta = metadata[i] ?? { name: `${i + 1}.json`, data: {} };
				if (!addItem(image, meta)) {
					await flushZip();
					addItem(image, meta);
				}
				onProgress?.({
					processed: i + 1,
					total: images.length,
					message: `Processing item ${i + 1}/${images.length}...`
				});
			}
		}

		await flushZip();

		if (import.meta.env.DEV)
			console.log(`Created ${currentZipIndex} ZIP files for large collection`);
	}
}
