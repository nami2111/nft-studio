import JSZip from 'jszip';

interface ZipMessage {
	type: 'zip-project';
	taskId: string;
	payload: {
		projectData: string;
		imageFiles: Array<{
			path: string;
			data: ArrayBuffer;
		}>;
	};
}

interface ZipChunkMessage {
	type: 'zip-chunk';
	taskId: string;
	payload: {
		imageFiles: Array<{
			path: string;
			data: ArrayBuffer;
		}>;
		isFinal: boolean;
	};
}

type IncomingZipMessage = ZipMessage | ZipChunkMessage;

const MAX_ZIP_RAW_SIZE = 700 * 1024 * 1024;

let currentTaskId: string | null = null;
let totalFilesAdded = 0;
let messagesReceived = 0;

let pendingFiles: Array<{ path: string; data: ArrayBuffer }> = [];
let pendingSize = 0;
let volumeIndex = 0;
let isFlushing = false;

async function flushVolume(isFinal: boolean): Promise<void> {
	const hasFiles = pendingFiles.length > 0;
	const filesToFlush = pendingFiles.length;
	const sizeToFlush = pendingSize;
	console.log(
		`[zip-worker] flushVolume: isFinal=${isFinal}, hasFiles=${hasFiles}, filesToFlush=${filesToFlush}, sizeToFlush=${(sizeToFlush / 1024 / 1024).toFixed(1)}MB`
	);

	if (!isFinal && !hasFiles) return;

	// For non-final flushes, only flush files up to the threshold to avoid OOM
	let filesToZip: Array<{ path: string; data: ArrayBuffer }> = pendingFiles;
	let bytesToZip = pendingSize;

	if (!isFinal && pendingSize > MAX_ZIP_RAW_SIZE) {
		let accSize = 0;
		let cutIndex = 0;
		for (let i = 0; i < pendingFiles.length; i++) {
			accSize += pendingFiles[i].data.byteLength;
			if (accSize >= MAX_ZIP_RAW_SIZE) {
				cutIndex = i + 1;
				break;
			}
		}
		if (cutIndex === 0) cutIndex = pendingFiles.length;
		filesToZip = pendingFiles.slice(0, cutIndex);
		bytesToZip = filesToZip.reduce((sum, f) => sum + f.data.byteLength, 0);
		console.log(
			`[zip-worker] Truncating flush to ${filesToZip.length} files (${(bytesToZip / 1024 / 1024).toFixed(1)}MB) to stay near threshold`
		);
	}

	const zip = new JSZip();
	for (const file of filesToZip) {
		zip.file(file.path, file.data);
	}

	// Remove flushed files from pending
	if (!isFinal && filesToZip.length < pendingFiles.length) {
		pendingFiles = pendingFiles.slice(filesToZip.length);
		pendingSize = pendingFiles.reduce((sum, f) => sum + f.data.byteLength, 0);
	} else {
		pendingFiles = [];
		pendingSize = 0;
	}

	try {
		let content: ArrayBuffer | null = null;
		let partIndex = volumeIndex;

		if (filesToZip.length > 0 || isFinal) {
			console.log(
				`[zip-worker] Generating ZIP volume ${volumeIndex + 1} with ${filesToZip.length} files...`
			);
			content = await zip.generateAsync({ type: 'arraybuffer' });
			volumeIndex++;
			partIndex = volumeIndex;
			console.log(
				`[zip-worker] ZIP volume ${partIndex} generated: ${(content.byteLength / 1024 / 1024).toFixed(1)}MB`
			);
		}

		if (content) {
			(self as unknown as Worker).postMessage(
				{
					type: 'zip-complete',
					taskId: currentTaskId,
					payload: {
						buffer: content,
						partIndex,
						isFinal
					}
				},
				[content] as unknown as Transferable[]
			);
			console.log(`[zip-worker] Posted ZIP volume ${partIndex} to main thread`);
		} else if (isFinal) {
			(self as unknown as Worker).postMessage({
				type: 'zip-complete',
				taskId: currentTaskId,
				payload: {
					partIndex: 0,
					isFinal: true
				}
			});
			console.log(`[zip-worker] Posted final completion signal (no files)`);
		}
	} catch (error) {
		console.error(`[zip-worker] ZIP generation failed:`, error);
		(self as unknown as Worker).postMessage({
			type: 'zip-error',
			taskId: currentTaskId,
			payload: {
				error: error instanceof Error ? error.message : String(error)
			}
		});
	}
}

async function flushAndDrain(): Promise<void> {
	isFlushing = true;
	try {
		// Flush current data
		await flushVolume(false);
		// Check if more data accumulated while we were flushing
		while (pendingSize >= MAX_ZIP_RAW_SIZE) {
			console.log(
				`[zip-worker] Drain: more data accumulated, flushing ${(pendingSize / 1024 / 1024).toFixed(1)}MB`
			);
			await flushVolume(false);
		}
	} finally {
		isFlushing = false;
	}
}

self.onmessage = async (event: MessageEvent<IncomingZipMessage>) => {
	const { type, taskId, payload } = event.data;

	if (type === 'zip-project') {
		const { projectData, imageFiles } = payload;
		const zip = new JSZip();

		try {
			zip.file('project.json', projectData);

			for (let i = 0; i < imageFiles.length; i++) {
				const file = imageFiles[i];
				zip.file(file.path, file.data);

				if (i % 50 === 0 || i === imageFiles.length - 1) {
					(self as unknown as Worker).postMessage({
						type: 'zip-progress',
						taskId,
						payload: {
							progress: Math.round(((i + 1) / imageFiles.length) * 100)
						}
					});
				}
			}

			const content = await zip.generateAsync({ type: 'arraybuffer' });

			(self as unknown as Worker).postMessage(
				{
					type: 'zip-complete',
					taskId,
					payload: {
						buffer: content
					}
				},
				[content] as unknown as Transferable[]
			);
		} catch (error) {
			(self as unknown as Worker).postMessage({
				type: 'zip-error',
				taskId,
				payload: {
					error: error instanceof Error ? error.message : String(error)
				}
			});
		}
	} else if (type === 'zip-chunk') {
		const { imageFiles, isFinal } = payload;
		messagesReceived++;

		if (currentTaskId !== taskId) {
			currentTaskId = taskId;
			pendingFiles = [];
			pendingSize = 0;
			volumeIndex = 0;
			totalFilesAdded = 0;
			messagesReceived = 0;
			console.log(`[zip-worker] New task started: ${taskId}`);
		}

		try {
			const chunkSize = imageFiles.length;
			let chunkBytes = 0;
			let emptyCount = 0;
			for (const file of imageFiles) {
				if (!file.data || file.data.byteLength === 0) {
					emptyCount++;
					console.warn(`[zip-worker] EMPTY FILE RECEIVED: ${file.path}`);
				}
				pendingFiles.push({ path: file.path, data: file.data });
				const fileBytes = file.data?.byteLength || 0;
				chunkBytes += fileBytes;
				pendingSize += fileBytes;
				totalFilesAdded++;
			}
			if (emptyCount > 0) {
				console.error(
					`[zip-worker] Message #${messagesReceived}: ${emptyCount}/${chunkSize} files have empty data!`
				);
			}

			if (messagesReceived % 20 === 0 || isFinal) {
				console.log(
					`[zip-worker] Message #${messagesReceived}: received ${chunkSize} files (${(chunkBytes / 1024 / 1024).toFixed(1)}MB), pending=${pendingFiles.length} files, ${(pendingSize / 1024 / 1024).toFixed(1)}MB, isFinal=${isFinal}`
				);
			}

			(self as unknown as Worker).postMessage({
				type: 'zip-progress',
				taskId,
				payload: {
					progress: isFinal ? 100 : 50,
					filesAdded: totalFilesAdded
				}
			});

			if (isFinal) {
				console.log(
					`[zip-worker] Finalizing: totalFilesAdded=${totalFilesAdded}, pendingFiles=${pendingFiles.length}, pendingSize=${(pendingSize / 1024 / 1024).toFixed(1)}MB`
				);
				// Wait for any in-progress flush to complete
				while (isFlushing) {
					await new Promise((r) => setTimeout(r, 10));
				}
				await flushVolume(true);
				console.log(`[zip-worker] Final flush complete`);
				currentTaskId = null;
				pendingFiles = [];
				pendingSize = 0;
				volumeIndex = 0;
				totalFilesAdded = 0;
				messagesReceived = 0;
			} else if (pendingSize >= MAX_ZIP_RAW_SIZE && !isFlushing) {
				console.log(
					`[zip-worker] Size threshold reached (${(pendingSize / 1024 / 1024).toFixed(1)}MB >= ${(MAX_ZIP_RAW_SIZE / 1024 / 1024).toFixed(0)}MB), flushing...`
				);
				await flushAndDrain();
				console.log(`[zip-worker] Flush complete, volumeIndex now=${volumeIndex}`);
			}
		} catch (error) {
			console.error(`[zip-worker] Error processing chunk:`, error);
			(self as unknown as Worker).postMessage({
				type: 'zip-error',
				taskId,
				payload: {
					error: error instanceof Error ? error.message : String(error)
				}
			});
			currentTaskId = null;
			pendingFiles = [];
			pendingSize = 0;
			volumeIndex = 0;
			totalFilesAdded = 0;
			messagesReceived = 0;
		}
	}
};
