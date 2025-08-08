// ... (unchanged parts of the component)

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
  import { projectStore, traitsStore } from '$lib/stores';
  import type { Project } from '$lib/types/project';
  import type { Layer } from '$lib/types/layer';
  import type { Trait } from '$lib/types/trait';
  import type { PreparedLayer, PreparedTrait } from '$lib/stores/traits';
  import {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    AppError,
    WorkerError,
    StorageError
  } from '$lib/utils/error-handling';
  import { logError, logWarning } from '$lib/utils/error-logger';
  import type { ErrorContext } from '$lib/utils/error-logger';
  import { retryWithErrorHandling, RetryConfigs } from '$lib/utils/retry';
  import { toast } from 'svelte-sonner';
  import { Loader2 } from 'lucide-svelte';

 // Lazy-loaded worker client APIs
  import { getGenerationWorker, postWorkerMessage, terminateGenerationWorker } from '$lib/workers/generation.worker.loader';
  import { cancelGeneration } from '$lib/workers/generation.worker.client';

  // UI state
  let open = $state(false);
  let collectionSize = $state(100);
  let isGenerating = $state(false);
  let generatedCount = $state(0);
  let totalCount = $state(0);
  let statusText = $state('Ready to generate.');

  let projectData: Project = $state({
    id: '',
    name: '',
    description: '',
    outputSize: { width: 1024, height: 1024 },
    layers: []
  });

  // Subscribe to project changes
  projectStore.project.subscribe((p) => {
    projectData = p;
  });

  function updateProgress(generated: number, total: number, text: string) {
    generatedCount = generated;
    totalCount = total;
    statusText = text;
  }

  function resetState() {
    isGenerating = false;
    updateProgress(0, 0, 'Ready to generate.');
    // Ensure any running worker is terminated
    terminateGenerationWorker();
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
    const errorContext: ErrorContext = {
      component: 'GenerationModal',
      action: 'handleGenerate',
      userAction: 'Generate Collection',
      additionalData: {
        collectionSize,
        layerCount: projectData.layers.length,
        projectName: projectData.name
      }
    };

    try {
      // Input validation
      if (projectData.layers.length === 0) {
        showError(
          new AppError(
            'Please add at least one layer before generating.',
            'VALIDATION_ERROR',
            errorContext
          )
        );
        return;
      }
      if (collectionSize < 1) {
        showError(new AppError('Collection size must be at least 1.', 'VALIDATION_ERROR', errorContext));
        return;
      }
      if (collectionSize > 10000) {
        showError(
          new AppError(
            'Collection size is limited to 10,000 items for performance.',
            'VALIDATION_ERROR',
            errorContext
          )
        );
        return;
      }

      // Check for missing image data
      if (traitsStore.hasMissingImageData()) {
        const missingImages = traitsStore.getLayersWithMissingImages();
        const traitList = missingImages
          .slice(0, 3)
          .map(
            (item: { layerName: string; traitName: string }) =>
              `"${item.traitName}" in layer "${item.layerName}"`
          )
          .join(', ');
        const moreText = missingImages.length > 3 ? ` and ${missingImages.length - 3} more` : '';

        const errorContextMissing: ErrorContext = {
          component: 'GenerationModal',
          action: 'startGeneration',
          userAction: 'generateNFTs',
          additionalData: {
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

      isGenerating = true;
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
                await packageZip(payload.images, payload.metadata);
                // Auto-refresh after successful generation
                setTimeout(() => {
                  window.location.reload();
                }, 2500);
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
                {
                  const workerErrorCtx: ErrorContext = {
                    component: 'GenerationModal',
                    action: 'handleWorkerMessage',
                    userAction: 'generateNFTs',
                    additionalData: {
                      workerError: payload?.message,
                      generatedCount: payload?.generatedCount ?? 0
                    }
                  };
                  const workerError = new WorkerError(payload?.message ?? 'Worker error', workerErrorCtx);
                  updateProgress(generatedCount, collectionSize, `Error: ${payload?.message ?? 'Worker error'}`);
                  showError(workerError);
                  resetState();
                }
                break;
              default:
                // Unknown message types
                break;
            }
          };

          const transfers = transferrableLayers.flatMap((layer: PreparedLayer) =>
            layer.traits
              .map((trait: PreparedTrait) => trait.imageData)
              .filter((d: ArrayBuffer): d is ArrayBuffer => d instanceof ArrayBuffer)
          );

          const messageData = {
            type: 'start',
            payload: {
              layers: transferrableLayers,
              collectionSize,
              outputSize: {
                width: projectData.outputSize.width,
                height: projectData.outputSize.height
              },
              projectName: String(projectData.name || ''),
              projectDescription: String(projectData.description || '')
            }
          };

          worker.postMessage(messageData, transfers);
        },
        RetryConfigs.default,
        errorContext,
        'Failed to start generation after multiple attempts'
      );
    } catch (error) {
      if (error instanceof AppError) {
        showError(error);
      } else {
        const genericError = new AppError(
          error instanceof Error ? error.message : 'An unknown error occurred.',
          'GENERATION_ERROR',
          errorContext,
          true
        );
        showError(genericError);
      }

      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      updateProgress(generatedCount, totalCount, `Error: ${message}`);
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
    isGenerating = false;
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
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Cancel
        </Button>
      {/if}
      <Button
        onclick={handleGenerate}
        disabled={isGenerating ||
          projectData.layers.length === 0 ||
          projectStore.projectNeedsZipLoad()}
      >
        {#if isGenerating}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Generating...
        {:else}
          Generate
        {/if}
      </Button>
    </div>
  </DialogContent>
</Dialog>

// ... (unchanged parts of the component)
