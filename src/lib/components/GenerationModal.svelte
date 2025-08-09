// ... (unchanged parts of the component)

<script lang="ts">
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import JSZip from 'jszip';
	import { project, traitsStore } from '$lib/stores/project.store';
	import { Button } from '$lib/components/ui/button';
	import { getGenerationWorker } from '$lib/workers/generation.worker.loader';
	import type { Layer } from '$lib/types/layer';
	import { prepareLayersForWorker } from '$lib/domain/project.domain';
	import { WorkerError } from '$lib/utils/error-handling';
	import { retryWithErrorHandling } from '$lib/utils/retry';
	import { loadingStore } from '$lib/stores/loading.store';
	import {
		X,
		AlertCircle,
		CheckCircle,
		Info,
		Package,
		Play,
		AlertTriangle
	} from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';

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
	let worker: Worker | null = null;
	let isCancelled = $state(false);
	// Accumulators for chunked data
	let allImages: { name: string; imageData: ArrayBuffer }[] = [];
	let allMetadata: { name: string; data: Record<string, unknown> }[] = [];

	// Progress update function
	function updateProgress(generated: number, total: number, text: string) {
		progress = Math.round((generated / total) * 100);
		statusText = text;
	}

  function resetState() {
    loadingStore.stop('generation');
    updateProgress(0, 0, 'Ready to generate.');
    // Ensure any running worker is terminated
    terminateGenerationWorker();
    // Clear accumulators
    allImages = [];
    allMetadata = [];
  }

  async function packageZip(
    images: { name: string; imageData: ArrayBuffer }[],
    metadata: { name: string; data: Record<string, unknown> }[]
  ) {
    const errorContext: ErrorContext = {
      component: 'GenerationModal',
      action: 'packageZip',
      userAction: 'Package Collection',
      additionalData: {
        imageCount: images.length,
        metadataCount: metadata.length,
        projectName: projectData.name
      }
    };

    updateProgress(images.length, images.length, 'Packaging files into a .zip...');

    try {
      await retryWithErrorHandling(
        async () => {
          const { default: JSZip } = await import('jszip');
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
          a.click;
          URL.revokeObjectURL(url);

          statusText = 'Download started.';
          showSuccess('Generation complete. Your download has started.');
        },
        RetryConfigs.default,
        errorContext,
        'Failed to package collection after multiple attempts'
      );
    } catch (error) {
      if (error instanceof AppError) {
        showError(error);
      } else {
        const storageError = new StorageError(
          error instanceof Error ? error.message : 'Failed to create .zip file.',
          errorContext
        );
        showError(storageError);
      }

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
				const workerError = new WorkerError('Project must have at least one layer.', {
					context: { component: 'GenerationModal', action: 'handleGenerate' },
					missingLayers: true
				});
				showError = true;
				errorDetails = { message: workerError.message, context: workerError.context };
				return;
			}

			// Validate layers have traits
			const emptyLayers = projectData.layers.filter((layer) => layer.traits.length === 0);
			if (emptyLayers.length > 0) {
				const workerError = new WorkerError(
					`The following layers have no traits: ${emptyLayers.map((l) => l.name).join(', ')}`,
					{
						context: { component: 'GenerationModal', action: 'handleGenerate' },
						emptyLayers: emptyLayers.map((l) => l.name)
					}
				);
				showError = true;
				errorDetails = { message: workerError.message, context: workerError.context };
				return;
			}

			// Check for missing image data
			const traitList = projectData.layers.flatMap((layer) =>
				layer.traits.map((trait) => ({ layer: layer.name, trait: trait.name, imageData: trait.imageData }))
			);
			const missingImages = traitList.filter((t) => !t.imageData || t.imageData.byteLength === 0);

			if (missingImages.length > 0) {
				const errorContextMissing = {
					context: {
						component: 'GenerationModal',
						action: 'handleGenerate',
						missingImageCount: missingImages.length,
						firstFewMissing: traitList
					}
				};

				const workerError = new WorkerError(
					`Missing image data for ${missingImages.length} traits. Please upload images for all traits before generating.`,
					errorContextMissing
				);
				showError(workerError);
				return;
			}

			// Start loading state
			loadingStore.start('generation');
			updateProgress(0, collectionSize, 'Validating project data...');

			// Use lazy-loaded worker for generation
			await retryWithErrorHandling(
				async () => {
					// Validate layers before starting generation
					const transferrableLayers = await traitsStore.prepareLayersForWorker(projectData.layers);

					updateProgress(0, collectionSize, 'Initializing worker...');

					// Initialize worker lazily and set up message handling
					const worker = await getGenerationWorker();
					worker.onmessage = async (e: MessageEvent) => {
						const { type, payload } = e.data as { type: string; payload?: any };

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
								if (!payload.isChunk) {
									await packageZip(allImages, allMetadata);
									// Auto-refresh after successful generation
									setTimeout(() => {
										window.location.reload();
									}, 2500);
								}
								break;
							case 'cancelled':
								updateProgress(payload.generatedCount ?? 0, payload.totalCount ?? collectionSize, 'Generation cancelled by user.');
								showInfo('Generation has been cancelled.');
								resetState();
								// Auto-refresh after cancellation
								setTimeout(() => {
									window.location.reload();
								}, 1500);
								break;
							case 'error':
								const error = new WorkerError(payload.message, payload.context);
								showError(error);
								resetState();
								break;
							default:
								console.warn('Unknown message type from worker:', type);
						}
					};

					// Start generation in worker
					worker.postMessage({
						type: 'generate',
						payload: {
							layers: transferrableLayers,
							collectionSize,
							projectName: projectData.name
						}
					});
				},
				{
					maxRetries: 3,
					baseDelay: 1000,
					onError: (error, attempt) => {
						console.error(`Generation attempt ${attempt} failed:`, error);
						toast.error(`Generation attempt ${attempt} failed. Retrying...`, {
							description: error instanceof Error ? error.message : 'Unknown error'
						});
					}
				}
			);
		} catch (error) {
			const workerError = new WorkerError(
				error instanceof Error ? error.message : 'An unknown error occurred during generation',
				{
					context: { component: 'GenerationModal', action: 'handleGenerate' },
					originalError: error
				}
			);
			showError(workerError);
			resetState();
		}
	}

  function handleModalInteraction(newOpenState: boolean) {
    open = newOpenState;
    // If closing the modal during generation, cancel it
    if (!newOpenState && isGenerating) {
      handleCancel();
    }
  }

  function handleCancel() {
    // Use the public cancel API to terminate the worker
    cancelGeneration();
    loadingStore.stop('generation');
    updateProgress(generatedCount, totalCount, 'Generation cancelled by user.');
    toast.info('Generation has been cancelled.');
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
            value={generatedCount}
            max={totalCount}
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

// ... (unchanged parts of the component)
