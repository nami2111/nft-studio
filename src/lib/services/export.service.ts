import type { Project } from '$lib/types/project';
import { isFlagEnabled } from '$lib/config/feature-flags';
import { MemoryMonitor } from '$lib/utils/memory-monitor';
import { iterateBySize } from '$lib/utils/streaming-storage';

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

/**
 * Track blob URLs created during export so they can be cleaned up on page unload.
 * We do NOT revoke URLs immediately after download because the browser may still
 * be streaming large files (700MB+) when revoke is called, causing data loss.
 */
const activeBlobUrls = new Set<string>();
let cleanupRegistered = false;

function registerBlobUrlCleanup(url: string): void {
	activeBlobUrls.add(url);
	if (!cleanupRegistered) {
		cleanupRegistered = true;
		window.addEventListener('beforeunload', () => {
			activeBlobUrls.forEach((u) => URL.revokeObjectURL(u));
			activeBlobUrls.clear();
		});
	}
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
/**
 * Queue for sequential downloads to prevent browser download manager overload.
 * Large blob URLs (700MB+) need time to begin streaming before the next download starts.
 */
const downloadQueue: Array<{ buffer: ArrayBuffer; filename: string }> = [];
let isProcessingDownloadQueue = false;

/**
 * Process the download queue sequentially with delays between each trigger.
 */
async function processDownloadQueue(): Promise<void> {
	if (isProcessingDownloadQueue) return;
	isProcessingDownloadQueue = true;

	while (downloadQueue.length > 0) {
		const { buffer, filename } = downloadQueue.shift()!;
		downloadZipBuffer(buffer, filename);
		// Wait 5 seconds between downloads to let the browser start streaming
		if (downloadQueue.length > 0) {
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}

	isProcessingDownloadQueue = false;
}

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
			if (import.meta.env.DEV) {
				console.log(
					`[zip-main] Received zip-complete: partIndex=${partIndex}, isFinal=${isFinal}, buffer=${buffer ? (buffer.byteLength / 1024 / 1024).toFixed(1) + 'MB' : 'null'}`
				);
			}
			if (buffer != null && partIndex != null) {
				const filename = `${zipStreamProjectName}_part_${partIndex}.zip`;
				downloadQueue.push({ buffer, filename });
				processDownloadQueue();
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
	const totalBytes = transferList.reduce((sum, b) => sum + b.byteLength, 0);
	if (import.meta.env.DEV && (isFinal || transferList.length % 100 === 0)) {
		console.log(
			`[zip-main] sendZipChunk: files=${imageFiles.length}, size=${(totalBytes / 1024 / 1024).toFixed(1)}MB, isFinal=${isFinal}`
		);
	}
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

		if (import.meta.env.DEV) console.log(`[zip-main] finalizeZipStream: sending final chunk`);

		// Set up timeout to reject if ZIP worker doesn't respond
		const timeoutId = setTimeout(() => {
			console.error(`[zip-main] ZIP finalization timed out after ${timeoutMs}ms`);
			zipStreamReject?.(new Error(`ZIP finalization timed out after ${timeoutMs}ms`));
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
			if (import.meta.env.DEV) console.log(`[zip-main] finalizeZipStream resolved`);
			resolve();
		};
		zipStreamReject = (error: Error) => {
			clearTimeout(timeoutId);
			console.error(`[zip-main] finalizeZipStream rejected:`, error.message);
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
	registerBlobUrlCleanup(url);
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
	}
}

export async function packageZip(options: ExportOptions): Promise<void> {
	const { project, images, metadata, onProgress } = options;

	// Use ZIP worker offloading when enabled and collection is large enough
	const useZipWorker = isFlagEnabled('enableZipWorkerOffloading') && images.length > 500;

	try {
		// Start memory monitoring for large exports
		if (images.length > 500) {
			MemoryMonitor.start();
		}

		if (useZipWorker) {
			await packageZipWithWorker({
				project,
				images,
				metadata,
				onProgress
			});
			return;
		}

		// Use optimized approach for large collections
		if (images.length > 1000) {
			await packageZipOptimized({
				project,
				images,
				metadata,
				onProgress
			});
		} else {
			await packageZipStandard({
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
async function packageZipWithWorker(options: ExportOptions): Promise<void> {
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

	// Capture total before clearing arrays so progress reports correctly
	const totalItems = images.length + metadata.length;

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
	downloadBlob(blob, `${project.name || 'collection'}.zip`);

	onProgress?.({
		processed: totalItems,
		total: totalItems,
		message: 'ZIP created and download started'
	});
}

/**
 * Start a streaming ZIP session. Creates a persistent ZIP worker that accumulates chunks.
 * Images are sent incrementally to avoid holding all data in main thread memory.
 */
export function startStreamingZip(taskId?: string, projectName?: string): void {
	const id = taskId || `zip-stream-${Date.now()}`;
	if (projectName) zipStreamProjectName = projectName;
	startZipStreamWorker(id);
	if (import.meta.env.DEV) console.log(`📦 Started streaming ZIP: ${id}`);
}

/**
 * Send a batch of images to the streaming ZIP worker.
 * The image ArrayBuffers are transferred (zero-copy) — caller should nullify references.
 */
export function addStreamingChunk(
	images: { name: string; data: ArrayBuffer }[],
	metadata: { name: string; data: Record<string, unknown> }[]
): void {
	const imageFiles: Array<{ path: string; data: ArrayBuffer }> = [];

	// Validate image data before sending
	const emptyImages = images.filter((img) => !img.data || img.data.byteLength === 0);
	if (emptyImages.length > 0) {
		console.error(
			`❌ addStreamingChunk: ${emptyImages.length} images have empty data:`,
			emptyImages.map((img) => img.name)
		);
	}

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
export async function finalizeStreamingZip(
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
export function cancelStreamingZip(): void {
	cancelZipStream();
}

/**
 * Package ZIP files directly from storage in size-bounded batches.
 * Each batch creates its own ZIP, downloads immediately, then GC frees the memory.
 * RAM stays bounded at targetChunkBytes regardless of collection size.
 */
export async function packageFromStorageBySize(
	sessionId: string,
	projectName: string,
	targetChunkBytes: number,
	onProgress?: (progress: { processed: number; total: number; message: string }) => Promise<void>
): Promise<void> {
	const { default: JSZip } = await import('jszip');
	let batchIndex = 0;

	await iterateBySize(sessionId, targetChunkBytes, async (batch, idx, total) => {
		onProgress?.({
			processed: idx + 1,
			total,
			message: `Packaging batch ${idx + 1}/${total} (${batch.images.length} items)...`
		});

		const zip = new JSZip();
		const imagesFolder = zip.folder('images');
		const metadataFolder = zip.folder('metadata');

		for (const img of batch.images) {
			imagesFolder?.file(img.name, img.imageData);
		}
		for (const meta of batch.metadata) {
			metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
		}

		const content = await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});

		const filename = `${projectName || 'collection'}_part_${idx + 1}_of_${total}.zip`;
		downloadBlob(content, filename);
		batchIndex++;
	});

	onProgress?.({
		processed: batchIndex,
		total: batchIndex,
		message: `All ${batchIndex} ZIP files downloaded`
	});
}

/**
 * @deprecated Use packageFromStorageBySize. Kept for compatibility during the storage migration window.
 */
export async function packageFromIndexedDBBySize(
	sessionId: string,
	projectName: string,
	targetChunkBytes: number,
	onProgress?: (progress: { processed: number; total: number; message: string }) => Promise<void>
): Promise<void> {
	return packageFromStorageBySize(sessionId, projectName, targetChunkBytes, onProgress);
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	registerBlobUrlCleanup(url);
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
	}
}

/**
 * Standard ZIP creation for smaller collections (≤1000 files)
 */
async function packageZipStandard(options: ExportOptions): Promise<void> {
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
	downloadZip(content, project);
}

/**
 * Optimized ZIP creation for larger collections with better memory management
 */
async function packageZipOptimized(options: ExportOptions): Promise<void> {
	const { project, images, metadata, onProgress } = options;

	// For very large collections or collections with large files, create multiple ZIPs
	if (images.length > 3000 || (images.length > 0 && images[0].imageData.byteLength > 500000)) {
		await createMultipleZips(options);
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
	downloadZip(content, project);
}

/**
 * Create multiple smaller ZIP files for very large collections based on size (2GB max per ZIP)
 */
async function createMultipleZips(options: ExportOptions): Promise<void> {
	const { project, images, metadata, onProgress } = options;

	const { default: JSZip } = await import('jszip');
	const MAX_ZIP_SIZE = 1 * 1024 * 1024 * 1024; // 1GB in bytes

	// Calculate approximate size for each item (image + metadata)
	const estimatedSizePerItem = estimateSizePerItem(images, metadata);
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
			await yieldIfHighMemoryPressure();

			// Finish current ZIP and start a new one
			const content = await currentZip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: { level: 6 }
			});

			// Download current ZIP
			const zipIndex = currentZipIndex + 1;
			downloadZipWithIndex(content, project, zipIndex, totalZips);

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
		await yieldIfHighMemoryPressure();

		const content = await currentZip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});

		const zipIndex = currentZipIndex + 1;
		downloadZipWithIndex(content, project, zipIndex, zipIndex);
	}

	// Show summary message
	if (import.meta.env.DEV)
		console.log(`Created ${currentZipIndex + 1} ZIP files for large collection`);
}

/**
 * Estimate the average size per item (image + metadata)
 */
function estimateSizePerItem(
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
async function yieldIfHighMemoryPressure(): Promise<void> {
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
function downloadZipWithIndex(content: Blob, project: Project, index: number, total: number): void {
	const url = URL.createObjectURL(content);
	registerBlobUrlCleanup(url);
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
	}
}

/**
 * Handle ZIP download with error handling
 */
function downloadZip(content: Blob, project: Project): void {
	const url = URL.createObjectURL(content);
	registerBlobUrlCleanup(url);
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
	}
}
