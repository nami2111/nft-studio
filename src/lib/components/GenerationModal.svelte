<script lang="ts">
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import JSZip from 'jszip';
	import { project } from '$lib/stores/project.store';
	import { Button } from '$lib/components/ui/button';
	import { startGeneration, cancelGeneration } from '$lib/workers/generation.worker.client';
	import { prepareLayersForWorker } from '$lib/domain/project.domain';
	import { loadingStore } from '$lib/stores/loading.store';
	import { X, AlertCircle, CheckCircle, Info, Package, Play, AlertTriangle } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import {
		Dialog,
		DialogTrigger,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';

	// State
	let collectionSize = $state(100);
	let isGenerating = $derived(loadingStore.isLoading('generation'));
	let progress = $state(0);
	let statusText = $state('Ready to generate');
	let showSuccess = $state(false);
	let showError = $state(false);
	let errorDetails = $state<{ message: string; context?: any } | null>(null);
	let showInfo = $state(false);
	let infoMessage = $state('');
	let isCancelled = $state(false);
	let open = $state(false);
	// Accumulators for chunked data
	let allImages: { name: string; imageData: ArrayBuffer }[] = [];
	let allMetadata: { name: string; data: Record<string, unknown> }[] = [];
	// Track if we've started packaging to prevent duplicate calls
	let isPackaging = $state(false);

	// Progress update function
	function updateProgress(generated: number, total: number, text: string) {
		progress = Math.round((generated / total) * 100);
		statusText = text;
	}

	function resetState() {
		loadingStore.stop('generation');
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
			showSuccess = true;
			toast.success('Generation complete. Your download has started.');
		} catch (error) {
			showError = true;
			errorDetails = {
				message: error instanceof Error ? error.message : 'Failed to create .zip file.'
			};
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
		showError = false;
		errorDetails = null;
		isCancelled = false;

		try {
			const projectData = get(project);

			// Validate project has layers
			if (projectData.layers.length === 0) {
				showError = true;
				errorDetails = { message: 'Project must have at least one layer.' };
				return;
			}

			// Validate layers have traits
			const emptyLayers = projectData.layers.filter((layer) => layer.traits.length === 0);
			if (emptyLayers.length > 0) {
				showError = true;
				errorDetails = {
					message: `The following layers have no traits: ${emptyLayers.map((l) => l.name).join(', ')}`
				};
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
				showError = true;
				errorDetails = {
					message: `Missing image data for ${missingImages.length} traits. Please upload images for all traits before generating.`
				};
				return;
			}

			// Start loading state
			loadingStore.start('generation');
			updateProgress(0, collectionSize, 'Validating project data...');

			// Validate layers before starting generation
			const transferrableLayers = await prepareLayersForWorker(projectData.layers);

			updateProgress(0, collectionSize, 'Initializing generation...');

			// Set up a simple event system to handle messages from workers
			const workerMessageHandler = async (event: MessageEvent) => {
				const { type, payload } = event.data;

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
							// Auto-refresh after successful generation
							setTimeout(() => {
								window.location.reload();
							}, 2500);
						}
						break;
					case 'cancelled':
						updateProgress(
							payload.generatedCount ?? 0,
							payload.totalCount ?? collectionSize,
							'Generation cancelled by user.'
						);
						showInfo = true;
						infoMessage = 'Generation has been cancelled.';
						resetState();
						// Auto-refresh after cancellation
						setTimeout(() => {
							window.location.reload();
						}, 1500);
						break;
					case 'error':
						showError = true;
						errorDetails = { message: payload.message };
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
			await startGeneration(
				transferrableLayers,
				collectionSize,
				{ width: 1024, height: 1024 }, // Default size, should be configurable
				projectData.name,
				projectData.description || ''
			);
		} catch (error) {
			showError = true;
			errorDetails = {
				message:
					error instanceof Error ? error.message : 'An unknown error occurred during generation'
			};
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
		loadingStore.stop('generation');
		updateProgress(0, collectionSize, 'Generation cancelled by user.');
		toast.info('Generation has been cancelled.');
		resetState();
	}
</script>

<Dialog bind:open onOpenChange={handleModalInteraction}>
	<DialogTrigger>
		<Button class="mt-6">Generate Collection</Button>
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
					<progress
						id="gen-progress"
						class="h-2.5 w-full [&::-moz-progress-bar]:bg-blue-600 [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-value]:bg-blue-600"
						value={progress}
						max="100"
					></progress>
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
