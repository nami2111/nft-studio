<script lang="ts">
	import { project } from '$lib/stores';
	import {
		startGeneration as startWorkerGeneration,
		cancelGeneration as cancelWorkerGeneration
	} from '$lib/domain/worker.service';
	import type {
		ProgressMessage,
		CompleteMessage,
		ErrorMessage,
		CancelledMessage,
		PreviewMessage
	} from '$lib/types/worker-messages';
	import type { Layer } from '$lib/types/layer';
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
	import GenerationProgress from './generation/GenerationProgress.svelte';
	import GenerationControls from './generation/GenerationControls.svelte';

	// Local UI state
	let collectionSize = $state<number | null>(100);
	let isComponentDestroyed = $state(false);
	let isPackaging = $state(false);

	// Derived state from persistent store
	let isGenerating = $derived(generationState.isGenerating && !generationState.isBackground);
	let isBackground = $derived(generationState.isBackground);
	let isPaused = $derived(generationState.isPaused);
	let previews = $derived(generationState.previews);

	// Component lifecycle management
	onDestroy(() => {
		isComponentDestroyed = true;

		console.log('🧹 GenerationForm component destroyed');

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
			console.log('🔄 Moving generation to background mode');
			pauseGeneration('Component unmounted - continuing in background');

			// Set timeout to prevent infinite background generation
			setTimeout(() => {
				if (generationState.isGenerating && isComponentDestroyed) {
					console.log('⏰ Background generation timeout - cancelling');
					cancelGeneration();
					console.log('Generation stopped due to timeout.');
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

		// Update status in persistent store
		generationState.statusText = 'Packaging files into a .zip...';

		try {
			await ExportService.packageZip({
				project: projectData,
				images,
				metadata,
				startTime: generationState.startTime ?? undefined
			});

			// Update persistent state
			generationState.statusText = 'Download started.';

			showSuccess('Generation complete', {
				description: 'Your download has started and NFTs have been added to the gallery.'
			});

			// Complete the generation in persistent store
			completeGeneration();
		} catch (error) {
			showError(error, {
				title: 'Package Error',
				description: 'Failed to create .zip file. Please try again.'
			});
			generationState.statusText = 'Error: Failed to create .zip file.';
			generationState.error = error instanceof Error ? error.message : 'Packaging failed';
		} finally {
			isPackaging = false;
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

			console.log(`🚀 Starting generation session: ${sessionId}`);

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
							if (message.payload.images) addImages(message.payload.images);
							if (message.payload.metadata)
								addMetadata(
									message.payload.metadata as { name: string; data: Record<string, unknown> }[]
								);
							// Check if generation is complete
							if (collectionSize && generationState.allImages.length >= collectionSize) {
								// Package in background if possible, or wait for user to return
								console.log('🎉 Generation completed in background');
							}
							break;
						case 'error':
							handleError(message);
							break;
						case 'cancelled':
							completeGeneration(); // Mark as complete but cancelled
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
						// Handle chunked image data
						if (message.payload.images && message.payload.images.length > 0) {
							addImages(message.payload.images);
						}
						if (message.payload.metadata && message.payload.metadata.length > 0) {
							addMetadata(
								message.payload.metadata as { name: string; data: Record<string, unknown> }[]
							);
						}

						// Check if generation is complete
						if (
							(collectionSize && generationState.allImages.length >= collectionSize) ||
							message.payload.images.length === 0
						) {
							console.log(
								'Generation complete, packaging:',
								generationState.allImages.length,
								'images,',
								generationState.allMetadata.length,
								'metadata'
							);

							// Package the completed generation
							await packageZip(generationState.allImages, generationState.allMetadata);
						}
						break;
					case 'cancelled':
						completeGeneration();
						showInfo('Generation has been cancelled.');
						break;
					case 'error':
						handleError(message);
						showError(new Error(message.payload.message), {
							title: 'Generation Error',
							description: 'An error occurred during generation. Please try again.'
						});
						break;
					default:
						console.warn('Unknown message type from worker:', (message as { type: string }).type);
				}
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
				workerMessageHandler
			);
		} catch (error) {
			showError(error, {
				title: 'Generation Failed',
				description: 'An unknown error occurred during generation. Please try again.'
			});
			resetState();
		}
	}

	function handleCancel() {
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
