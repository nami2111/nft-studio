<script lang="ts">
    import { project } from '$lib/stores';
    import { startGeneration as startWorkerGeneration } from '$lib/domain/worker.service';
    import type {
        ProgressMessage,
        CompleteMessage,
        ErrorMessage,
        CancelledMessage,
        PreviewMessage
    } from '$lib/types/worker-messages';
    import { showError, showSuccess, showInfo, showWarning } from '$lib/utils/error-handling';
    import {
        generationState,
        startGeneration,
        pauseGeneration,
        completeGeneration,
        cancelGeneration,
        resetState,
        updateProgress,
        addImages,
        addMetadata,
        addPreviews,
        handleError
    } from '$lib/stores/generation-progress.svelte';
    import { onDestroy } from 'svelte';
    import { MetadataStandard } from '$lib/domain/metadata/strategies';
    import { ExportService } from '$lib/services/export.service';
    import { isFlagEnabled } from '$lib/config/feature-flags';
    import GenerationProgress from './GenerationProgress.svelte';
    import GenerationControls from './GenerationControls.svelte';

    // Local UI state
    let collectionSize = $state<number | null>(100);
    let isComponentDestroyed = $state(false);
    let isPackaging = $state(false);
    let isStreamingZip = $state(false);

    // Derived state from persistent store
    const isGenerating = $derived(generationState.isGenerating && !generationState.isBackground);
    const isBackground = $derived(generationState.isBackground);
    const isPaused = $derived(generationState.isPaused);
    const previews = $derived(generationState.previews);

    // Component lifecycle management
    onDestroy(() => {
        isComponentDestroyed = true;

if (import.meta.env.DEV) console.log('🧹 GenerationForm component destroyed');

        // Clean up UI resources only
        previews.forEach((p) => {
            try {
                URL.revokeObjectURL(p.url);
            } catch (error) {
                console.warn('Failed to revoke ObjectURL during cleanup:', error);
            }
        });

        // If generation is active, move to background mode instead of cancelling
        if (generationState.isGenerating && !generationState.isBackground) {
if (import.meta.env.DEV) console.log('🔄 Moving generation to background mode');
            pauseGeneration('Component unmounted - continuing in background');

            // Set timeout to prevent infinite background generation
            setTimeout(() => {
                if (generationState.isGenerating && isComponentDestroyed) {
if (import.meta.env.DEV) console.log('⏰ Background generation timeout - cancelling');
                    cancelGeneration();
if (import.meta.env.DEV) console.log('Generation stopped due to timeout.');
                }
            }, 600000); // 10 minutes timeout
        }
    });

    function resetLocalState() {
        isPackaging = false;
        // Reset persistent state
        resetState();
    }

    async function packageZip(
        images: { name: string; imageData: ArrayBuffer }[],
        metadata: { name: string; data: Record<string, unknown> }[]
    ) {
        // Prevent duplicate packaging calls
        if (isPackaging) return;
        isPackaging = true;

        const projectData = project;

        try {
            generationState.statusText = `Packaging ${images.length} items into ZIP...`;

            await ExportService.packageZip({
                project: projectData,
                images,
                metadata,
                startTime: generationState.startTime ?? undefined,
                onProgress: (progress) => {
                    const percentage = Math.round((progress.processed / progress.total) * 100);
                    generationState.statusText = percentage < 100
                        ? `Packaging ZIP (${percentage}%) — ${progress.message}`
                        : progress.message;

                    if (import.meta.env.DEV && (percentage % 10 === 0 || progress.processed === progress.total)) {
                        console.log(`Export progress: ${percentage}% (${progress.processed}/${progress.total})`);
                    }
                }
            });

            // Update persistent state
            generationState.statusText = 'Download started.';

            showSuccess('Generation complete', {
                description: `Your download has started (${images.length} items). ${images.length > 5000 ? 'Multiple ZIP files were created for optimal performance.' : ''}`
            });

            // Complete the generation in persistent store
            completeGeneration();

            // Free memory from accumulated image/metadata data
            generationState.allImages = [];
            generationState.allMetadata = [];
        } catch (error) {
            console.error('Export error details:', error);

            // Handle memory allocation errors specifically
            if (error instanceof Error && error.message.includes('Array buffer allocation failed')) {
                showError(error, {
                    title: 'Memory Limit Exceeded',
                    description:
                        'The collection is too large to export as a single ZIP file. Multiple smaller ZIP files will be created automatically for collections over 3000 items. Please try generating a smaller batch or wait for memory to free up.'
                });
                generationState.statusText = 'Memory limit reached. Try smaller batches.';
            } else {
                showError(error, {
                    title: 'Package Error',
                    description: 'Failed to create .zip file. Please try again.'
                });
                generationState.statusText = 'Error: Failed to create .zip file.';
            }
            generationState.error = error instanceof Error ? error.message : 'Packaging failed';
        } finally {
            isPackaging = false;
            // Free memory from accumulated data regardless of outcome
            generationState.allImages = [];
            generationState.allMetadata = [];
        }
    }

    async function handleGenerate(event?: MouseEvent) {
        // Prevent accidental closing during generation
        if (event) {
            event.preventDefault();
        }

        // Reset local UI state
        resetLocalState();

        try {
            const projectData = project;

            // Validate project has layers
            if (projectData.layers.length === 0) {
                showWarning('Project must have at least one layer.', {
                    description: 'Validation Error'
                });
                return;
            }

            // Validate project has valid output size
            if (projectData.outputSize.width <= 0 || projectData.outputSize.height <= 0) {
                showWarning(
                    'Project output size not set. Please upload an image to set the project dimensions.',
                    {
                        description: 'Validation Error'
                    }
                );
                return;
            }

            // Validate layers have traits
            const emptyLayers = projectData.layers.filter((layer) => layer.traits.length === 0);
            if (emptyLayers.length > 0) {
                showWarning(
                    `The following layers have no traits: ${emptyLayers.map((l) => l.name).join(', ')}`,
                    {
                        description: 'Validation Error'
                    }
                );
                return;
            }

            // Check for missing image data
            const missingImages = projectData.layers.flatMap((layer) =>
                layer.traits.filter((trait) => !trait.imageData || trait.imageData.byteLength === 0)
            );
            if (missingImages.length > 0) {
                showWarning(
                    `Missing image data for ${missingImages.length} traits. Please upload images for all traits before generating.`,
                    {
                        description: 'Validation Error'
                    }
                );
                return;
            }

            // Start generation using persistent store
            const sessionId = startGeneration({
                projectName: projectData.name || 'Untitled Collection',
                projectDescription: projectData.description || '',
                outputSize: projectData.outputSize,
                layers: projectData.layers,
                collectionSize: collectionSize || 100,
                strictPairConfig: projectData.strictPairConfig,
                metadataStandard: projectData.metadataStandard || MetadataStandard.ERC721
            });

if (import.meta.env.DEV) console.log(`🚀 Starting generation session: ${sessionId}`);

            // Start streaming ZIP worker to receive batches during generation
            ExportService.startStreamingZip(sessionId, projectData.name || 'collection');
            isStreamingZip = true;

            // Set up worker message handler that delegates to persistent store
            const workerMessageHandler = async (
                data: ProgressMessage | CompleteMessage | ErrorMessage | CancelledMessage | PreviewMessage
            ) => {
                const message = data;

                // Skip processing if component was destroyed and generation is in background
                if (isComponentDestroyed && generationState.isBackground) {
                    // Still update persistent store but don't update UI
                    switch (message.type) {
                        case 'progress':
                            updateProgress(message);
                            break;
                        case 'complete':
                            // Handle streamed/chunked image data
                            if (message.payload.images && message.payload.images.length > 0) {
                                if (message.payload.isChunk && isStreamingZip) {
                                    if (isFlagEnabled('enableStreamingStorage')) {
                                        addImages(message.payload.images);
                                        if (message.payload.metadata?.length) {
                                            addMetadata(
                                                message.payload.metadata as { name: string; data: Record<string, unknown> }[]
                                            );
                                        }
                                    }
                                    const streamImages = message.payload.images.map((img) => ({
                                        name: img.name,
                                        data: img.imageData
                                    }));
                                    ExportService.addStreamingChunk(
                                        streamImages,
                                        message.payload.metadata || []
                                    );
                                    message.payload.images.length = 0;
                                } else {
                                    addImages(message.payload.images);
                                }
                            }

                            // Finalize ZIP when scheduler sends terminal complete (isChunk absent)
                            if (!message.payload.isChunk) {
                                if (isStreamingZip && collectionSize) {
                                    try {
                                        await ExportService.finalizeStreamingZip(
                                            projectData.name || 'collection'
                                        );
                                    } catch (err) {
                                        console.error('Background ZIP finalization failed:', err);
                                    }
                                    isStreamingZip = false;
                                }
if (import.meta.env.DEV) console.log('🎉 Generation completed in background');
                            }
                            break;
                        case 'error':
                            if (isStreamingZip) {
                                ExportService.cancelStreamingZip();
                                isStreamingZip = false;
                            }
                            handleError(message);
                            break;
                        case 'cancelled':
                            if (isStreamingZip) {
                                ExportService.cancelStreamingZip();
                                isStreamingZip = false;
                            }
                            completeGeneration(); // Mark as complete but cancelled
                            break;
                        case 'chunk':
                            if (message.payload.images && message.payload.images.length > 0 && isStreamingZip) {
                                const streamImages = message.payload.images.map((img) => ({
                                    name: img.name,
                                    data: img.imageData
                                }));
                                ExportService.addStreamingChunk(
                                    streamImages,
                                    message.payload.metadata || []
                                );
                                message.payload.images.length = 0;
                            }
                            break;
                    }
                    return;
                }

                // Process messages for active component
                switch (message.type) {
                    case 'progress':
                        updateProgress(message);
                        break;
                    case 'preview': {
                        const { payload } = message as PreviewMessage;
                        const newPreviews: { index: number; url: string }[] = [];
                        for (let j = 0; j < payload.indexes.length; j++) {
                            const buffer = payload.previewData[j];
                            const blob = new Blob([buffer], { type: 'image/png' });
                            const url = URL.createObjectURL(blob);
                            newPreviews.push({ index: payload.indexes[j], url });
                        }
                        addPreviews(newPreviews);
                        break;
                    }
                    case 'complete':
                        // Handle streamed/chunked image data
                        if (message.payload.images && message.payload.images.length > 0) {
                            if (message.payload.isChunk && isStreamingZip) {
                                if (isFlagEnabled('enableStreamingStorage')) {
                                    addImages(message.payload.images);
                                    if (message.payload.metadata?.length) {
                                        addMetadata(
                                            message.payload.metadata as { name: string; data: Record<string, unknown> }[]
                                        );
                                    }
                                }
                                // Stream to ZIP worker — transfer ownership, don't accumulate
                                const streamImages = message.payload.images.map((img) => ({
                                    name: img.name,
                                    data: img.imageData
                                }));
                                ExportService.addStreamingChunk(
                                    streamImages,
                                    message.payload.metadata || []
                                );
                                // Images transferred to ZIP — clear reference
                                message.payload.images.length = 0;
                            } else {
                                addImages(message.payload.images);
                            }
                        }
                        if (
                            !message.payload.isChunk &&
                            message.payload.metadata &&
                            message.payload.metadata.length > 0
                        ) {
                            addMetadata(
                                message.payload.metadata as { name: string; data: Record<string, unknown> }[]
                            );
                        }

                        // Package when the scheduler sends the terminal complete (isChunk is absent/undefined)
                        if (!message.payload.isChunk) {
                            if (isStreamingZip) {
                                // Finalize streaming ZIP instead of packaging from memory
                                generationState.statusText = 'Finalizing ZIP...';
                                await ExportService.finalizeStreamingZip(
                                    projectData.name || 'collection',
                                    (progress) => {
                                        generationState.statusText =
                                            progress.message;
                                    }
                                );
                                isStreamingZip = false;
                                showSuccess('Generation complete', {
                                    description: `Your download has started.`
                                });
                                completeGeneration();
                                generationState.allImages = [];
                                generationState.allMetadata = [];
                            } else {
                                if (import.meta.env.DEV)
                                    console.log(
                                        'Generation complete, packaging:',
                                        generationState.allImages.length,
                                        'images,',
                                        generationState.allMetadata.length,
                                        'metadata'
                                    );

                                await packageZip(generationState.allImages, generationState.allMetadata);
                            }
                        }
                        break;
                    case 'cancelled':
                        if (isStreamingZip) {
                            ExportService.cancelStreamingZip();
                            isStreamingZip = false;
                        }
                        completeGeneration();
                        showInfo('Generation has been cancelled.');
                        break;
                    case 'error':
                        if (isStreamingZip) {
                            ExportService.cancelStreamingZip();
                            isStreamingZip = false;
                        }
                        handleError(message);
                        showError(new Error(message.payload.message), {
                            title: 'Generation Error',
                            description: 'An error occurred during generation. Please try again.'
                        });
                        break;
                    case 'chunk':
                        if (message.payload.images && message.payload.images.length > 0 && isStreamingZip) {
                            const streamImages = message.payload.images.map((img) => ({
                                name: img.name,
                                data: img.imageData
                            }));
                            ExportService.addStreamingChunk(
                                streamImages,
                                message.payload.metadata || []
                            );
                            message.payload.images.length = 0;
                        }
                        break;
                    default:
                        console.warn('Unknown message type from worker:', (message as { type: string }).type);
                }
            };

            // Prepare extra metadata for strategies
            const extraData = {
                symbol: projectData.symbol,
                seller_fee_basis_points: projectData.sellerFeeBasisPoints,
                external_url: projectData.externalUrl,
                animation_url: projectData.animationUrl,
                creators: projectData.creators
            };

            // Start generation using the domain service with worker message handler
            await startWorkerGeneration(
                projectData.layers,
                collectionSize || 100,
                projectData.outputSize,
                projectData.name,
                projectData.description || '',
                projectData.metadataStandard,
                projectData.strictPairConfig,
                extraData,
                workerMessageHandler
            );
        } catch (error) {
            // Cancel streaming ZIP if active
            if (isStreamingZip) {
                ExportService.cancelStreamingZip();
                isStreamingZip = false;
            }
            showError(error, {
                title: 'Generation Failed',
                description: 'An unknown error occurred during generation. Please try again.'
            });
            resetState();
        }
    }

    function handleCancel() {
        // Cancel streaming ZIP if active
        if (isStreamingZip) {
            ExportService.cancelStreamingZip();
            isStreamingZip = false;
        }
        // Cancel generation and clean up all resources
        cancelGeneration();
        showInfo('Generation has been cancelled.');
    }
</script>

<div class="space-y-4 sm:space-y-6">
    <GenerationProgress {isBackground} {isPaused} {isGenerating} />

    <GenerationControls
        bind:collectionSize
        {isGenerating}
        {isBackground}
        onGenerate={handleGenerate}
        onCancel={handleCancel}
    />
</div>
