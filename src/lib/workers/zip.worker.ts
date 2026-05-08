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

let pendingFiles: Array<{ path: string; data: ArrayBuffer }> = [];
let pendingSize = 0;
let volumeIndex = 0;

async function flushVolume(isFinal: boolean): Promise<void> {
	// Track if there's anything to flush
	const hasFiles = pendingFiles.length > 0;

	// For non-final: skip if nothing to flush
	// For final: always send completion signal, even if empty (to resolve Promise on main thread)
	if (!isFinal && !hasFiles) return;

	const zip = new JSZip();
	for (const file of pendingFiles) {
		zip.file(file.path, file.data);
	}

	pendingFiles = [];
	pendingSize = 0;

	try {
		let content: ArrayBuffer | null = null;
		let partIndex = volumeIndex;

		if (hasFiles || isFinal) {
			content = await zip.generateAsync({ type: 'arraybuffer' });
			volumeIndex++;
			partIndex = volumeIndex;
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
		} else if (isFinal) {
			// Final with no files - send empty completion to resolve main thread
			(self as unknown as Worker).postMessage({
				type: 'zip-complete',
				taskId: currentTaskId,
				payload: {
					partIndex: 0,
					isFinal: true
				}
			});
		}
	} catch (error) {
		(self as unknown as Worker).postMessage({
			type: 'zip-error',
			taskId: currentTaskId,
			payload: {
				error: error instanceof Error ? error.message : String(error)
			}
		});
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

		if (currentTaskId !== taskId) {
			currentTaskId = taskId;
			pendingFiles = [];
			pendingSize = 0;
			volumeIndex = 0;
			totalFilesAdded = 0;
		}

		try {
			for (const file of imageFiles) {
				pendingFiles.push({ path: file.path, data: file.data });
				pendingSize += file.data.byteLength;
				totalFilesAdded++;
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
				await flushVolume(true);
				currentTaskId = null;
				pendingFiles = [];
				pendingSize = 0;
				volumeIndex = 0;
				totalFilesAdded = 0;
			} else if (pendingSize >= MAX_ZIP_RAW_SIZE) {
				await flushVolume(false);
			}
		} catch (error) {
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
		}
	}
};
