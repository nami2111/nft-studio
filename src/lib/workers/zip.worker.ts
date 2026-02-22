/**
 * Web Worker for handling ZIP compression off the main thread.
 * Uses JSZip to bundle project metadata and image files.
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

self.onmessage = async (event: MessageEvent<ZipMessage>) => {
	const { type, taskId, payload } = event.data;

	if (type === 'zip-project') {
		const { projectData, imageFiles } = payload;

		// Since esModuleInterop is true, we can use JSZip as a constructor directly
		const zip = new JSZip();

		try {
			// Add project metadata
			zip.file('project.json', projectData);

			// Add all image files
			for (let i = 0; i < imageFiles.length; i++) {
				const file = imageFiles[i];
				zip.file(file.path, file.data);

				// Report progress every 5 files
				if (i % 5 === 0 || i === imageFiles.length - 1) {
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
	}
};
