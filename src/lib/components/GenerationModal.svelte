<script lang="ts">
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import JSZip from 'jszip';
	import { project, loadingStates, startLoading, stopLoading } from '$lib/stores/runes-store';
	import { Button } from '$lib/components/ui/button';
	import { startGeneration, cancelGeneration } from '$lib/workers/generation.worker.client';
	import { prepareLayersForWorker } from '$lib/domain/project.domain';
	import { Play } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import {
		Dialog,
		DialogTrigger,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Progress } from '$lib/components/ui/progress';

	// State
	let collectionSize = $state(100);
	let isGenerating = $derived(loadingStates['generation']);
	let progress = $state(0);
	let statusText = $state('Ready to generate');
	let open = $state(false);
	// Accumulators for chunked data
	let allImages: { name: string; imageData: ArrayBuffer }[] = [];
	let allMetadata: { name: string; data: Record<string, unknown> }[] = [];
	// Track if we've started packaging to prevent duplicate calls
	let isPackaging = $state(false);

	// Progress update function
	function updateProgress(generated: number, total: number, text: string) {
		// Prevent division by zero which would result in non-finite values
		if (total <= 0) {
			progress = 0;
		} else {
			// Ensure the ratio is finite before calculating percentage
			const ratio = generated / total;
			if (isFinite(ratio)) {
				progress = Math.round(ratio * 100);
			} else {
				progress = 0;
			}
		}
		statusText = text;
	}

	function resetState() {
		stopLoading('generation');
		updateProgress(0, 0, 'Ready to generate.');
		// Clear accumulators
		allImages = [];
		allMetadata = [];
		isPackaging = false;
	}

	async function packageZip(
		images: { name: string; imageData: ArrayBuffer }[],
		metadata: { name: string; data: Record<string, unknown> }[]
	) {
		// Prevent duplicate packaging calls
		if (isPackaging) return;
		isPackaging = true;

		const projectData = get(project);
		updateProgress(images.length, images.length, 'Packaging files into a .zip...');

		try {
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');
			const metadataFolder = zip.folder('metadata');

			for (const file of images) {
				imagesFolder?.file(file.name, file.imageData);
			}
			for (const meta of metadata) {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			}

			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${projectData.name || 'collection'}.zip`;
			a.click();
			URL.revokeObjectURL(url);

			statusText = 'Download started.';
			toast.success('Generation complete. Your download has started.');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create .zip file.');
			statusText = 'Error: Failed to create .zip file.';
		} finally {
			resetState();
		}
	}

	async function handleGenerate(event?: MouseEvent) {
		// Prevent accidental closing during generation
		if (event) {
			event.preventDefault();
		}

		// Reset state
		resetState();

		try {
			const projectData = get(project);

			// Validate project has layers
			if (projectData.layers.length === 0) {
				toast.error('Project must have at least one layer.');
				return;
			}

			// Validate project has valid output size
			if (projectData.outputSize.width <= 0 || projectData.outputSize.height <= 0) {
				toast.error(
					'Project output size not set. Please upload an image to set the project dimensions.'
				);
				return;
			}

			// Validate layers have traits
			const emptyLayers = projectData.layers.filter((layer) => layer.traits.length === 0);
			if (emptyLayers.length > 0) {
				toast.error(
					`The following layers have no traits: ${emptyLayers.map((l) => l.name).join(', ')}`
				);
				return;
			}

			// Check for missing image data
			const traitList = projectData.layers.flatMap((layer) =>
				layer.traits.map((trait) => ({
					layer: layer.name,
					trait: trait.name,
					imageData: trait.imageData
				}))
			);
			const missingImages = traitList.filter((t) => !t.imageData || t.imageData.byteLength === 0);

			if (missingImages.length > 0) {
				toast.error(
					`Missing image data for ${missingImages.length} traits. Please upload images for all traits before generating.`
				);
				return;
			}

			// Start loading state
			startLoading('generation');
			updateProgress(0, collectionSize, 'Validating project data...');

			// Validate layers before starting generation
			const transferrableLayers = await prepareLayersForWorker(projectData.layers);

			updateProgress(0, collectionSize, 'Initializing generation...');

			// Set up a simple event system to handle messages from workers
			const workerMessageHandler = async (data: unknown) => {
				const { type, payload } = data as
					| {
							type: 'progress';
							payload: { generatedCount: number; totalCount: number; statusText: string };
					  }
					| {
							type: 'complete';
							payload: {
								images: { name: string; imageData: ArrayBuffer }[];
								metadata: { name: string; data: Record<string, unknown> }[];
							};
					  }
					| { type: 'error'; payload: { message: string } }
					| { type: 'cancelled'; payload: { generatedCount?: number; totalCount?: number } };

				switch (type) {
					case 'progress':
						updateProgress(payload.generatedCount, payload.totalCount, payload.statusText);
						break;
					case 'complete':
						// Handle chunked image data
						if (payload.images && payload.images.length > 0) {
							// This is a chunk of images, accumulate them
							allImages.push(...payload.images);
						}
						if (payload.metadata && payload.metadata.length > 0) {
							// This is a chunk of metadata, accumulate them
							allMetadata.push(...payload.metadata);
						}
						// If this is the final message (no more chunks expected)
						// In our new system, we'll know it's done when we've received all expected items
						if (allImages.length >= collectionSize || payload.images.length === 0) {
							await packageZip(allImages, allMetadata);
							open = false;
						}
						break;
					case 'cancelled':
						updateProgress(
							payload.generatedCount ?? 0,
							payload.totalCount ?? collectionSize,
							'Generation cancelled by user.'
						);
						// Show info message for cancellation
						toast.info('Generation has been cancelled.');
						resetState();
						open = false;
						break;
					case 'error':
						toast.error(payload.message);
						resetState();
						break;
					default:
						console.warn('Unknown message type from worker:', type);
				}
			};

			// Add the message handler to the worker pool
			// We'll need to implement a proper event system in the worker pool
			// For now, we'll use a simplified approach

			// Start generation using the worker pool
			startGeneration(
				transferrableLayers,
				collectionSize,
				projectData.outputSize, // Use project's output size
				projectData.name,
				projectData.description || '',
				workerMessageHandler
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'An unknown error occurred during generation'
			);
			resetState();
		}
	}

	function handleModalInteraction(newOpenState: boolean) {
		// If closing the modal during generation, cancel it
		if (!newOpenState && isGenerating) {
			handleCancel();
		}
		open = newOpenState;
	}

	function handleCancel() {
		// Use the public cancel API to terminate all workers
		cancelGeneration();
		stopLoading('generation');
		updateProgress(0, collectionSize, 'Generation cancelled by user.');
		toast.info('Generation has been cancelled.');
		resetState();
	}
</script>

<Dialog bind:open onOpenChange={handleModalInteraction}>
	<DialogTrigger>
		<Button class="h-auto px-8 py-4 text-lg">Generate Collection</Button>
	</DialogTrigger>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Generate Collection</DialogTitle>
			<DialogDescription>Configure your collection generation settings.</DialogDescription>
		</DialogHeader>

		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<label for="collectionSize" class="text-right">Collection Size</label>
				<input
					id="collectionSize"
					type="number"
					min="1"
					max="10000"
					class="col-span-3 rounded border p-2"
					bind:value={collectionSize}
					disabled={isGenerating}
				/>
			</div>

			<div class="grid grid-cols-4 items-center gap-4">
				<label class="text-right" for="gen-progress">Progress</label>
				<div class="col-span-3">
					<Progress value={progress} max={100} class="w-full" />
					<p class="mt-1 text-sm text-gray-500">{statusText}</p>
				</div>
			</div>
		</div>

		<div class="flex justify-end space-x-2">
			{#if isGenerating}
				<Button variant="outline" onclick={handleCancel}>
					<LoadingIndicator operation="generation" message="Canceling..." />
				</Button>
			{/if}
			<Button
				onclick={handleGenerate}
				disabled={isGenerating || collectionSize <= 0 || collectionSize > 10000}
			>
				{#if isGenerating}
					<LoadingIndicator operation="generation" message="Generating..." />
				{:else}
					<Play class="mr-2 h-4 w-4" />
					Generate
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>