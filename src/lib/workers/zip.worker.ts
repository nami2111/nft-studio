/**
 * Web Worker for handling ZIP compression off the main thread.
 * Uses JSZip to bundle project metadata and image files.
 * Accepts chunked input for streaming large collections.
 */

import JSZip from 'jszip';

interface ZipMessage {
	type: 'zip-project';
	taskId: string;
	payload: {
		projectData: string; // JSON string of the project
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

let currentZip: JSZip | null = null;
let currentTaskId: string | null = null;
let totalFilesAdded = 0;

self.onmessage = async (event: MessageEvent<IncomingZipMessage>) => {
	const { type, taskId, payload } = event.data;

	if (type === 'zip-project') {
		const { projectData, imageFiles } = payload;
		const zip = new JSZip();

		try {
			// Add project metadata
			zip.file('project.json', projectData);

			// Add all image files
			for (let i = 0; i < imageFiles.length; i++) {
				const file = imageFiles[i];
				zip.file(file.path, file.data);

				// Report progress every 50 files to reduce message overhead
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

			// Generate ZIP file
			const content = await zip.generateAsync({ type: 'arraybuffer' });

			// Return the final ZIP
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

		if (!currentZip || currentTaskId !== taskId) {
			currentZip = new JSZip();
			currentTaskId = taskId;
			totalFilesAdded = 0;
		}

		try {
			for (const file of imageFiles) {
				currentZip.file(file.path, file.data);
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
				const content = await currentZip.generateAsync({ type: 'arraybuffer' });
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
				currentZip = null;
				currentTaskId = null;
			}
		} catch (error) {
			(self as unknown as Worker).postMessage({
				type: 'zip-error',
				taskId,
				payload: {
					error: error instanceof Error ? error.message : String(error)
				}
			});
			currentZip = null;
			currentTaskId = null;
		}
	}
};
