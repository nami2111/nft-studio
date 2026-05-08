import type { Project } from '$lib/types/project';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { MemoryMonitor } from '$lib/utils/memory-monitor';

export interface ExportOptions {
	project: Project;
	images: { name: string; imageData: ArrayBuffer }[];
	metadata: { name: string; data: Record<string, unknown> }[];
	startTime?: number;
	onProgress?: (progress: { processed: number; total: number; message: string }) => void;
}

interface ZipWorkerMessage {
	type: 'zip-project';
	taskId: string;
	payload: {
		projectData: string;
		imageFiles: Array<{ path: string; data: ArrayBuffer }>;
	};
}

interface ZipChunkMessage {
	type: 'zip-chunk';
	taskId: string;
	payload: {
		imageFiles: Array<{ path: string; data: ArrayBuffer }>;
		isFinal: boolean;
	};
}

interface ZipWorkerResponse {
	type: 'zip-complete' | 'zip-error' | 'zip-progress';
	taskId: string;
	payload: {
		buffer?: ArrayBuffer;
		error?: string;
		progress?: number;
		filesAdded?: number;
		partIndex?: number;
		isFinal?: boolean;
	};
}

function runZipWorker(message: ZipWorkerMessage, transfer?: Transferable[]): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.postMessage(message, { transfer });

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

/**
 * Streaming ZIP: maintains a persistent ZIP worker that accepts incremental chunks
 * via the zip-chunk protocol. Finalize to get the complete ZIP.
 */
let zipStreamWorker: Worker | null = null;
let zipStreamTaskId: string | null = null;
let zipStreamResolve: (() => void) | null = null;
let zipStreamReject: ((error: Error) => void) | null = null;
let zipStreamProjectName = 'collection';

/**
 * Start a streaming ZIP session. Creates a persistent worker that accumulates chunks.
 */
function startZipStreamWorker(taskId: string): void {
	if (zipStreamWorker) {
		zipStreamWorker.terminate();
		zipStreamWorker = null;
	}
	zipStreamTaskId = taskId;
	zipStreamWorker = new Worker(new URL('../workers/zip.worker.ts', import.meta.url), {
		type: 'module'
	});

	zipStreamWorker.onmessage = (e: MessageEvent<ZipWorkerResponse>) => {
		const data = e.data;
		if (data.type === 'zip-complete') {
			const { buffer, partIndex, isFinal } = data.payload;
			if (buffer && partIndex) {
				downloadZipBuffer(buffer, `${zipStreamProjectName}_part_${partIndex}.zip`);
			}

			if (isFinal) {
				const resolve = zipStreamResolve;
				const worker = zipStreamWorker;
				zipStreamResolve = null;
				zipStreamReject = null;
				zipStreamWorker = null;
				zipStreamTaskId = null;
				if (worker) worker.terminate();
				if (resolve) resolve();
			}
		} else if (data.type === 'zip-error') {
			const reject = zipStreamReject;
			const worker = zipStreamWorker;
			zipStreamResolve = null;
			zipStreamReject = null;
			zipStreamWorker = null;
			zipStreamTaskId = null;
			if (worker) worker.terminate();
			if (reject) reject(new Error(data.payload?.error || 'ZIP worker error'));
		}
	};

	zipStreamWorker.onerror = () => {
		const reject = zipStreamReject;
		const worker = zipStreamWorker;
		zipStreamResolve = null;
		zipStreamReject = null;
		zipStreamWorker = null;
		zipStreamTaskId = null;
		if (worker) worker.terminate();
		if (reject) reject(new Error('ZIP worker failed'));
	};
}

/**
 * Send a chunk of files to the streaming ZIP worker.
 * Images are transferred via Transferable (zero-copy). Caller should nullify references after.
 */
function sendZipChunk(
	imageFiles: Array<{ path: string; data: ArrayBuffer }>,
	isFinal: boolean
): void {
	if (!zipStreamWorker || !zipStreamTaskId) {
		throw new Error('ZIP stream not started');
	}

	const transferList = imageFiles.map((f) => f.data);
	const message: ZipChunkMessage = {
		type: 'zip-chunk',
		taskId: zipStreamTaskId,
		payload: { imageFiles, isFinal }
	};

	zipStreamWorker.postMessage(message, transferList);
}

/**
 * Finalize the streaming ZIP and wait for the complete buffer.
 * Includes timeout to prevent hanging forever.
 */
function finalizeZipStream(timeoutMs = 60000): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!zipStreamWorker || !zipStreamTaskId) {
			reject(new Error('ZIP stream not started'));
			return;
		}

		// Set up timeout to reject if ZIP worker doesn't respond
		const timeoutId = setTimeout(() => {
			zipStreamReject?.(new Error('ZIP finalization timed out after 60 seconds'));
			zipStreamResolve = null;
			zipStreamReject = null;
			if (zipStreamWorker) {
				zipStreamWorker.terminate();
				zipStreamWorker = null;
			}
			zipStreamTaskId = null;
		}, timeoutMs);

		zipStreamResolve = () => {
			clearTimeout(timeoutId);
			resolve();
		};
		zipStreamReject = (error: Error) => {
			clearTimeout(timeoutId);
			reject(error);
		};

		try {
			sendZipChunk([], true);
		} catch (err) {
			clearTimeout(timeoutId);
			reject(err);
		}
	});
}

/**
 * Cancel/abort a streaming ZIP session and clean up.
 */
function cancelZipStream(): void {
	const worker = zipStreamWorker;
	zipStreamResolve = null;
	zipStreamReject = null;
	zipStreamWorker = null;
	zipStreamTaskId = null;
	if (worker) worker.terminate();
}

function downloadZipBuffer(buffer: ArrayBuffer, filename: string): void {
	const blob = new Blob([buffer], { type: 'application/zip' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	try {
		a.click();
	} catch (error) {
		console.error('Download failed:', error);
	} finally {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
}

export class ExportService {
	/**
	 * Package files into a ZIP with memory-efficient batch processing
	 */
	static async packageZip(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		// Use ZIP worker offloading when enabled and collection is large enough
		const useZipWorker = isFlagEnabled('enableZipWorkerOffloading') && images.length > 500;

		try {
			// Start memory monitoring for large exports
			if (images.length > 500) {
				MemoryMonitor.start();
			}

			if (useZipWorker) {
				await ExportService.packageZipWithWorker({
					project,
					images,
					metadata,
					onProgress
				});
				return;
			}

			// Use optimized approach for large collections
			if (images.length > 1000) {
				await ExportService.packageZipOptimized({
					project,
					images,
					metadata,
					onProgress
				});
			} else {
				await ExportService.packageZipStandard({
					project,
					images,
					metadata,
					onProgress
				});
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
	 * Offload ZIP creation to a dedicated web worker.
	 */
	private static async packageZipWithWorker(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		const transferList: ArrayBuffer[] = [];
		const imageFiles = images.map((img) => {
			transferList.push(img.imageData);
			return {
				path: `images/${img.name}`,
				data: img.imageData
			};
		});

		// Add metadata as JSON files
		for (const meta of metadata) {
			const encoded = new TextEncoder().encode(JSON.stringify(meta.data, null, 2));
			const buffer = encoded.buffer.slice(
				encoded.byteOffset,
				encoded.byteOffset + encoded.byteLength
			);
			transferList.push(buffer);
			imageFiles.push({
				path: `metadata/${meta.name}`,
				data: buffer
			});
		}

		onProgress?.({
			processed: 0,
			total: images.length + metadata.length,
			message: 'Offloading ZIP creation to worker...'
		});

		// Clear source arrays - buffers are transferred to worker
		images.length = 0;
		metadata.length = 0;

		const projectData = JSON.stringify({
			name: project.name,
			description: project.description,
			outputSize: project.outputSize
		});

		const buffer = await runZipWorker(
			{
				type: 'zip-project',
				taskId: `zip-${Date.now()}`,
				payload: {
					projectData,
					imageFiles
				}
			},
			transferList
		);

		const blob = new Blob([buffer], { type: 'application/zip' });
		ExportService.downloadBlob(blob, `${project.name || 'collection'}.zip`);

		onProgress?.({
			processed: images.length + metadata.length,
			total: images.length + metadata.length,
			message: 'ZIP created and download started'
		});
	}

	/**
	 * Start a streaming ZIP session. Creates a persistent ZIP worker that accumulates chunks.
	 * Images are sent incrementally to avoid holding all data in main thread memory.
	 */
	static startStreamingZip(taskId?: string, projectName?: string): void {
		const id = taskId || `zip-stream-${Date.now()}`;
		if (projectName) zipStreamProjectName = projectName;
		startZipStreamWorker(id);
		if (import.meta.env.DEV) console.log(`📦 Started streaming ZIP: ${id}`);
	}

	/**
	 * Send a batch of images to the streaming ZIP worker.
	 * The image ArrayBuffers are transferred (zero-copy) — caller should nullify references.
	 */
	static addStreamingChunk(
		images: { name: string; data: ArrayBuffer }[],
		metadata: { name: string; data: Record<string, unknown> }[]
	): void {
		const imageFiles: Array<{ path: string; data: ArrayBuffer }> = [];

		for (const img of images) {
			imageFiles.push({ path: `images/${img.name}`, data: img.data });
		}
		for (const meta of metadata) {
			const jsonStr = JSON.stringify(meta.data, null, 2);
			const encoded = new TextEncoder().encode(jsonStr);
			const buffer = encoded.buffer.slice(
				encoded.byteOffset,
				encoded.byteOffset + encoded.byteLength
			);
			imageFiles.push({ path: `metadata/${meta.name}`, data: buffer });
		}

		sendZipChunk(imageFiles, false);
	}

	/**
	 * Finalize the streaming ZIP and return the complete blob.
	 * Cleans up the persistent ZIP worker.
	 */
	static async finalizeStreamingZip(
		projectName: string,
		onProgress?: (progress: { processed: number; total: number; message: string }) => void
	): Promise<void> {
		onProgress?.({
			processed: 0,
			total: 1,
			message: 'Finalizing ZIP...'
		});

		zipStreamProjectName = projectName;
		await finalizeZipStream();

		onProgress?.({
			processed: 1,
			total: 1,
			message: 'ZIP download started'
		});
	}

	/**
	 * Cancel/abort an active streaming ZIP session.
	 */
	static cancelStreamingZip(): void {
		cancelZipStream();
	}

	private static downloadBlob(blob: Blob, filename: string): void {
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
		ExportService.downloadZip(content, project);
	}

	/**
	 * Optimized ZIP creation for larger collections with better memory management
	 */
	private static async packageZipOptimized(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		// For very large collections or collections with large files, create multiple ZIPs
		if (images.length > 3000 || (images.length > 0 && images[0].imageData.byteLength > 500000)) {
			await ExportService.createMultipleZips(options);
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

			// Yield to event loop periodically
			if (i % (chunkSize * 2) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			onProgress?.({
				processed: i + chunkSize,
				total: images.length + metadata.length + 1,
				message: `Processing images (${Math.min(i + chunkSize, images.length)}/${images.length})...`
			});
		}

		for (let i = 0; i < metadata.length; i += chunkSize) {
			const chunk = metadata.slice(i, i + chunkSize);
			chunk.forEach((meta) => {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			});

			// Yield to event loop periodically
			if (i % (chunkSize * 2) === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			onProgress?.({
				processed: images.length + i + chunkSize,
				total: images.length + metadata.length + 1,
				message: `Processing metadata (${Math.min(i + chunkSize, metadata.length)}/${metadata.length})...`
			});
		}

		// Generate ZIP with optimized settings
		const content = await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});
		ExportService.downloadZip(content, project);
	}

	/**
	 * Create multiple smaller ZIP files for very large collections based on size (2GB max per ZIP)
	 */
	private static async createMultipleZips(options: ExportOptions): Promise<void> {
		const { project, images, metadata, onProgress } = options;

		const { default: JSZip } = await import('jszip');
		const MAX_ZIP_SIZE = 1 * 1024 * 1024 * 1024; // 1GB in bytes

		// Calculate approximate size for each item (image + metadata)
		const estimatedSizePerItem = ExportService.estimateSizePerItem(images, metadata);
		const estimatedTotalSize = images.length * estimatedSizePerItem;

		// Calculate number of ZIP files needed based on size
		const estimatedZipCount = Math.ceil(estimatedTotalSize / MAX_ZIP_SIZE);

		if (import.meta.env.DEV)
			console.log(
				`Estimated total collection size: ${(estimatedTotalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`
			);
		// Pre-calculate total ZIP count for accurate progress display
		const totalZips = Math.max(1, estimatedZipCount);

		if (import.meta.env.DEV) console.log(`Will create ${totalZips} ZIP files`);

		let currentZip = new JSZip();
		let currentZipImages = currentZip.folder('images');
		let currentZipMetadata = currentZip.folder('metadata');
		let currentZipSize = 0;
		let currentZipIndex = 0;
		let partStartIndex = 0;

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
				// Check memory pressure before generating ZIP — yield if high
				await ExportService.yieldIfHighMemoryPressure();

				// Finish current ZIP and start a new one
				const content = await currentZip.generateAsync({
					type: 'blob',
					compression: 'DEFLATE',
					compressionOptions: { level: 6 }
				});

				// Download current ZIP
				const zipIndex = currentZipIndex + 1;
				ExportService.downloadZipWithIndex(content, project, zipIndex, totalZips);

				// Free memory: remove processed items from source arrays
				const itemsInPart = i - partStartIndex;
				if (itemsInPart > 0) {
					images.splice(partStartIndex, itemsInPart);
					metadata.splice(partStartIndex, itemsInPart);
					i -= itemsInPart;
				}

				// Reset for next ZIP
				currentZip = new JSZip();
				currentZipImages = currentZip.folder('images');
				currentZipMetadata = currentZip.folder('metadata');
				currentZipSize = 0;
				currentZipIndex++;
				partStartIndex = i;
			}

			// Add image and metadata to current ZIP
			currentZipImages?.file(image.name, image.imageData);
			currentZipMetadata?.file(meta.name, JSON.stringify(meta.data, null, 2));
			currentZipSize += itemTotalSize;

			onProgress?.({
				processed: i + 1,
				total: images.length,
				message: `Processing item ${i + 1}/${images.length}...`
			});
		}

		// Don't forget the last ZIP file
		if (currentZipSize > 0) {
			// Check memory pressure before generating the final ZIP
			await ExportService.yieldIfHighMemoryPressure();

			const content = await currentZip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: { level: 6 }
			});

			const zipIndex = currentZipIndex + 1;
			ExportService.downloadZipWithIndex(content, project, zipIndex, zipIndex);
		}

		// Show summary message
		if (import.meta.env.DEV)
			console.log(`Created ${currentZipIndex + 1} ZIP files for large collection`);
	}

	/**
	 * Estimate the average size per item (image + metadata)
	 */
	private static estimateSizePerItem(
		images: { imageData: ArrayBuffer }[],
		metadata: { data: Record<string, unknown> }[]
	): number {
		// Sample the first 10 items to estimate average size
		const sampleSize = Math.min(10, images.length);
		let totalSize = 0;

		for (let i = 0; i < sampleSize; i++) {
			const imageSize = images[i]?.imageData?.byteLength || 0;
			const metadataSize = new Blob([JSON.stringify(metadata[i]?.data || {}, null, 2)]).size;
			totalSize += imageSize + metadataSize;
		}

		// Return average size per item
		return totalSize / sampleSize || 1; // Default to 1 byte if no data
	}

	/**
	 * Check memory pressure before a large operation. If memory is critically high,
	 * yield to the event loop and trigger GC to reduce pressure.
	 */
	private static async yieldIfHighMemoryPressure(): Promise<void> {
		const pressure = MemoryMonitor.getPressureLevel();
		if (pressure === 'high') {
			MemoryMonitor.triggerGarbageCollection();
			// Yield to let GC complete
			await new Promise((resolve) => setTimeout(resolve, 100));
		} else if (pressure === 'medium') {
			// Brief yield to allow any pending GC
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	/**
	 * Download ZIP file with index in filename
	 */
	private static downloadZipWithIndex(
		content: Blob,
		project: Project,
		index: number,
		total: number
	): void {
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${project.name || 'collection'}_part_${index}_of_${total}.zip`;

		document.body.appendChild(a);
		try {
			a.click();
			if (import.meta.env.DEV) console.log(`Download initiated for part ${index} of ${total}`);
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
	private static downloadZip(content: Blob, project: Project): void {
		const url = URL.createObjectURL(content);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${project.name || 'collection'}.zip`;

		// Try programmatic download
		document.body.appendChild(a);
		try {
			a.click();
			if (import.meta.env.DEV) console.log('Download initiated for:', a.download);
		} catch (error) {
			console.error('Download failed:', error);
			throw error;
		} finally {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	}
}
