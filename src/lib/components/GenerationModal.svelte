<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '$lib/components/ui/dialog';
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
			worker = new Worker('$lib/workers/generation.worker.ts', { type: 'module' });
			
			// Listen for messages from the worker
			worker.onmessage = (e) => {
				const { type, payload } = e.data;
				
				switch (type) {
					case 'progress':
						// Update progress bar and status text
						updateProgress(payload.generatedCount, payload.totalCount, payload.statusText);
						break;
					case 'complete':
						// Handle completion
						updateProgress(payload.images.length, payload.images.length, 'Generation complete!');
						isGenerating = false;
						worker?.terminate();
						worker = null;
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
			
			// Send the start message with project data
			worker.postMessage({
				type: 'start',
				payload: {
					layers: transferrableLayers,
					collectionSize,
					outputSize: projectData.outputSize
				}
			});
		} catch (error) {
			console.error('Error starting generation:', error);
			updateProgress(generatedCount, totalCount, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
			<DialogDescription>
				Configure your collection generation settings
			</DialogDescription>
		</DialogHeader>
		
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<label for="collectionSize" class="text-right">Collection Size</label>
				<input
					id="collectionSize"
					type="number"
					min="1"
					class="col-span-3 p-2 border rounded"
					bind:value={collectionSize}
					disabled={isGenerating}
				/>
			</div>
			
			<div class="grid grid-cols-4 items-center gap-4">
				<label class="text-right">Progress</label>
				<div class="col-span-3">
					<div class="w-full bg-gray-200 rounded-full h-2.5">
						<div 
							class="bg-blue-600 h-2.5 rounded-full" 
							style={`width: ${totalCount > 0 ? (generatedCount / totalCount) * 100 : 0}%`}
						></div>
					</div>
					<p class="text-sm text-gray-500 mt-1">{statusText}</p>
				</div>
			</div>
		</div>
		
		<div class="flex justify-end space-x-2">
			<Button variant="outline" on:click={handleCancel} disabled={!isGenerating}>
				Cancel
			</Button>
			<Button on:click={handleGenerate} disabled={isGenerating}>
				{isGenerating ? 'Generating...' : 'Generate'}
			</Button>
		</div>
	</DialogContent>
</Dialog>