<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { project, prepareLayersForWorker } from '$lib/stores/project.store';
	import type { Project } from '$lib/types/project';

	let collectionSize = $state(100);
	let isGenerating = $state(false);
	let generatedCount = $state(0);
	let totalCount = $state(0);
	let statusText = $state('Ready to generate');
	let worker: Worker | null = $state(null);

	// Get project data from store
	let projectData: Project = $state({
		id: '',
		name: '',
		description: '',
		outputSize: { width: 1024, height: 1024 },
		layers: []
	});

	// Subscribe to store changes
	project.subscribe((p) => {
		projectData = p;
	});

	function updateProgress(generated: number, total: number, text: string) {
		generatedCount = generated;
		totalCount = total;
		statusText = text;
	}

	async function handleGenerate() {
		isGenerating = true;
		updateProgress(0, collectionSize, 'Starting generation...');

		try {
			// Prepare layers for transfer to worker
			const transferrableLayers = await prepareLayersForWorker(projectData.layers);

			// Create a new instance of the Web Worker
			worker = new Worker(new URL('$lib/workers/generation.worker.ts', import.meta.url), {
				type: 'module'
			});

			// Listen for messages from the worker
			worker.onmessage = (e) => {
				const { type, payload } = e.data;

				switch (type) {
					case 'progress':
						// Update progress bar and status text
						updateProgress(payload.generatedCount, payload.totalCount, payload.statusText);
						break;
					case 'complete':
						updateProgress(payload.images.length, payload.images.length, 'Packaging zip...');
						(async () => {
							try {
								const { default: JSZip } = await import('jszip');
								const zip = new JSZip();
								const imagesFolder = zip.folder('images');
								const metadataFolder = zip.folder('metadata');
								for (const file of payload.images) {
									const arrayBuffer = await file.blob.arrayBuffer();
									imagesFolder?.file(file.name, arrayBuffer);
								}
								for (const meta of payload.metadata) {
									const json = JSON.stringify(meta.data, null, 2);
									metadataFolder?.file(meta.name, json);
								}
								const content = await zip.generateAsync({ type: 'blob' });
								const url = URL.createObjectURL(content);
								const a = document.createElement('a');
								a.href = url;
								a.download = `${projectData.name || 'collection'}.zip`;
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								URL.revokeObjectURL(url);
								statusText = 'Download ready';
								import('svelte-sonner').then(({ toast }) =>
									toast.success('Zip ready for download')
								);
							} catch (err) {
								console.error(err);
								statusText = 'Failed to package zip';
								import('svelte-sonner').then(({ toast }) => toast.error('Failed to package zip'));
							} finally {
								isGenerating = false;
								worker?.terminate();
								worker = null;
							}
						})();
						break;
					case 'error':
						// Handle error
						console.error(`Error: ${payload.message}`);
						updateProgress(generatedCount, totalCount, `Error: ${payload.message}`);
						isGenerating = false;
						worker?.terminate();
						worker = null;
						break;
				}
			};

			// Send the start message with project data and transfer buffers
			const transfers: ArrayBuffer[] = [];
			for (const layer of transferrableLayers) {
				for (const trait of layer.traits) {
					if (trait.imageData instanceof ArrayBuffer) transfers.push(trait.imageData);
				}
			}

			// Create a clean copy of the data to send to the worker
			const messageData = {
				type: 'start',
				payload: {
					layers: transferrableLayers,
					collectionSize,
					outputSize: {
						width: projectData.outputSize.width,
						height: projectData.outputSize.height
					},
					projectName: projectData.name,
					projectDescription: projectData.description
				}
			};

			worker.postMessage(messageData, transfers);
		} catch (error) {
			console.error('Error starting generation:', error);
			updateProgress(
				generatedCount,
				totalCount,
				`Error: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			isGenerating = false;
		}
	}

	function handleCancel() {
		if (worker) {
			worker.terminate();
			worker = null;
		}
		isGenerating = false;
		updateProgress(generatedCount, totalCount, 'Generation cancelled');
	}
</script>

<Dialog>
	<DialogTrigger>
		<Button class="mt-6">Generate Collection</Button>
	</DialogTrigger>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Generate Collection</DialogTitle>
			<DialogDescription>Configure your collection generation settings</DialogDescription>
		</DialogHeader>

		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<label for="collectionSize" class="text-right">Collection Size</label>
				<input
					id="collectionSize"
					type="number"
					min="1"
					class="col-span-3 rounded border p-2"
					bind:value={collectionSize}
					disabled={isGenerating}
				/>
			</div>

			<div class="grid grid-cols-4 items-center gap-4">
				<label class="text-right" for="gen-progress">Progress</label>
				<div class="col-span-3">
					<div
						id="gen-progress"
						role="progressbar"
						aria-valuemin="0"
						aria-valuemax={totalCount}
						aria-valuenow={generatedCount}
						class="h-2.5 w-full rounded-full bg-gray-200"
					>
						<div
							class="h-2.5 rounded-full bg-blue-600"
							style={`width: ${totalCount > 0 ? (generatedCount / totalCount) * 100 : 0}%`}
						></div>
					</div>
					<p class="mt-1 text-sm text-gray-500">{statusText}</p>
				</div>
			</div>
		</div>

		<div class="flex justify-end space-x-2">
			<Button variant="outline" onclick={handleCancel} disabled={!isGenerating}>Cancel</Button>
			<Button onclick={handleGenerate} disabled={isGenerating}>
				{isGenerating ? 'Generating...' : 'Generate'}
			</Button>
		</div>
	</DialogContent>
</Dialog>
