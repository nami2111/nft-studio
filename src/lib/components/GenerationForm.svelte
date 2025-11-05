<script lang="ts">
	// JSZip will be imported dynamically when needed
	import { project } from '$lib/stores';
	import { startGeneration as startWorkerGeneration, cancelGeneration as cancelWorkerGeneration } from '$lib/domain/worker.service';
	import { Play, AlertCircle } from 'lucide-svelte';
		import { Progress } from '$lib/components/ui/progress';
	import { Button } from '$lib/components/ui/button';
	import type {
		ProgressMessage,
		CompleteMessage,
		ErrorMessage,
		CancelledMessage,
		PreviewMessage
	} from '$lib/types/worker-messages';
	import type { Layer } from '$lib/types/layer';
	import { showError, showSuccess, showInfo, showWarning } from '$lib/utils/error-handling';
	import { trackGenerationCompleted } from '$lib/utils/analytics';
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
	import {
		generationState,
		generationStateManager,
		startGeneration,
		pauseGeneration,
		completeGeneration,
		cancelGeneration,
		updateProgress,
		addImages,
		addMetadata,
		addPreviews,
		addUsedCombination,
		isCombinationUsed,
		handleError,
		addWarning,
		resetState,
		getMemorySummary,
		getSummary
	} from '$lib/stores/generation-progress.svelte.ts';
	import { onDestroy } from 'svelte';

	// Local UI state
	let collectionSize = $state(100);
	let isComponentDestroyed = $state(false);
	let isPackaging = $state(false);
	let analyticsTracked = $state(false);

	// Derived state from persistent store
	let isGenerating = $derived(generationState.isGenerating && !generationState.isBackground);
	let isBackground = $derived(generationState.isBackground);
	let isPaused = $derived(generationState.isPaused);
	let progress = $derived(generationState.progress);
	let statusText = $derived(generationState.statusText);
	let memoryUsage = $derived(generationState.memoryUsage);
	let previews = $derived(generationState.previews);
	let currentSessionId = $derived(generationState.sessionId);

	
	// Component lifecycle management
	onDestroy(() => {
		isComponentDestroyed = true;

		console.log('🧹 GenerationForm component destroyed');

		// Clean up UI resources only
		previews.forEach(p => {
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
					addWarning('Generation stopped due to timeout.');
				}
			}, 600000); // 10 minutes timeout
		}
	});

	// Update progress function now delegates to persistent store
	function updateProgressLocal(
		generated: number,
		total: number,
		text: string,
		memory?: { used: number; available: number; units: string }
	) {
		// This is now handled by the persistent store
		// Keep for backward compatibility with existing code
	}

	function resetLocalState() {
		stopLoading('generation');
		isPackaging = false;
		analyticsTracked = false;

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

		const projectData = project as {
			name: string;
			outputSize: { width: number; height: number };
			description?: string;
			layers: Layer[];
			strictPairConfig?: import('$lib/types/layer').StrictPairConfig;
		};

		// Update status in persistent store
		generationState.statusText = 'Packaging files into a .zip...';

		try {
			// Save to gallery first
			try {
				console.log('Saving generated NFTs to gallery...');

				// Convert images and metadata to gallery format
				const galleryNFTs = images.map((image, index) => {
					const matchingMetadata = metadata.find((meta) => meta.name === image.name);
					return {
						name: image.name.replace('.png', ''),
						imageData: image.imageData,
						metadata: matchingMetadata?.data || { traits: [] },
						index
					};
				});

				// Import into gallery store
				const collection = galleryStore.importGeneratedNFTs(
					galleryNFTs,
					projectData.name || 'Untitled Collection',
					projectData.description || 'Generated NFT collection'
				);

				// Calculate rarity for the collection
				const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
				galleryStore.updateCollection(collection.id, updatedCollection);

				console.log(`Saved ${galleryNFTs.length} NFTs to gallery collection: ${collection.name}`);
			} catch (galleryError) {
				console.error('Failed to save to gallery:', galleryError);
				// Don't let gallery errors prevent the download
			}

			// Dynamically import JSZip to reduce initial bundle size
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
			// Try programmatic download
			document.body.appendChild(a);
			try {
				a.click();
				console.log('Download initiated for:', a.download);
			} catch (error) {
				console.error('Download failed:', error);
				throw error;
			} finally {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}

			// Update persistent state
			generationState.statusText = 'Download started.';

			// Track generation completion analytics (only once)
			if (!analyticsTracked && generationState.startTime) {
				const durationSeconds = Math.round((Date.now() - generationState.startTime) / 1000);
				trackGenerationCompleted(images.length, durationSeconds);
				analyticsTracked = true;
			}

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
			const projectData = project as {
				name: string;
				outputSize: { width: number; height: number };
				description?: string;
				layers: Layer[];
				strictPairConfig?: import('$lib/types/layer').StrictPairConfig;
			};

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

			// Start loading state
			startLoading('generation');

			// Start generation using persistent store
			const sessionId = startGeneration({
				projectName: projectData.name || 'Untitled Collection',
				projectDescription: projectData.description || '',
				outputSize: projectData.outputSize,
				layers: projectData.layers,
				collectionSize,
				strictPairConfig: projectData.strictPairConfig
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
							if (message.payload.metadata) addMetadata(message.payload.metadata);
							// Check if generation is complete
							if (generationState.allImages.length >= collectionSize) {
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
							addMetadata(message.payload.metadata);
						}

						// Check if generation is complete
						if (generationState.allImages.length >= collectionSize || message.payload.images.length === 0) {
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
				collectionSize,
				projectData.outputSize,
				projectData.name,
				projectData.description || '',
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
		stopLoading('generation');
		showInfo('Generation has been cancelled.');
	}

	// Get generation status summary for UI
	function getGenerationStatus() {
		const summary = getSummary();
		return {
			...summary,
			memoryUsage: getMemorySummary(),
			hasPreviews: generationState.previews.length > 0,
			warnings: generationState.warnings,
			error: generationState.error
		};
	}
</script>

<div class="space-y-4 sm:space-y-6">
	<div class="space-y-4 py-4">
		<!-- Collection Size Input - Responsive Layout -->
		<div class="grid gap-2 sm:grid-cols-[1fr_3fr] sm:items-center sm:gap-4">
			<label class="text-sm font-medium sm:text-right" for="collectionSize">Collection Size</label>
			<input
				id="collectionSize"
				type="number"
				min="1"
				max="10000"
				class="border-input bg-background focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
				bind:value={collectionSize}
				disabled={isGenerating}
			/>
		</div>

		<!-- Background Generation Status -->
		{#if isBackground}
			<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
				<div class="flex items-center gap-2">
					<AlertCircle class="h-4 w-4 text-yellow-600" />
					<div class="flex-1">
						<p class="text-sm font-medium text-yellow-800">Generation Running in Background</p>
						<p class="text-xs text-yellow-600">
							Session {currentSessionId?.slice(0, 8)}... • {generationState.currentIndex} of {generationState.totalItems} items
						</p>
					</div>
				</div>
			</div>
		{/if}

		
		<!-- Progress Section - Responsive Layout -->
		<div class="grid gap-2 sm:grid-cols-[1fr_3fr] sm:items-center sm:gap-4">
			<label class="text-sm font-medium sm:text-right" for="gen-progress">
				{isBackground ? 'Background Progress' : 'Progress'}
			</label>
			<div class="space-y-2">
				<Progress value={progress} max={100} class="w-full" />
				<p class="text-muted-foreground text-sm break-words">{statusText}</p>

				<!-- Generation Status Details -->
				{#if currentSessionId}
					<div class="text-xs text-muted-foreground space-y-1">
						<p>Session: {currentSessionId.slice(0, 12)}...</p>
						{#if generationState.startTime}
							<p>Started: {new Date(generationState.startTime).toLocaleTimeString()}</p>
						{/if}
						{#if isPaused}
							<p class="text-yellow-600">⏸️ Paused</p>
						{:else if isBackground}
							<p class="text-blue-600">🔄 Running in background</p>
						{/if}
					</div>
				{/if}

				{#if memoryUsage}
					<p class="text-muted-foreground text-sm">
						Memory: {Math.round(memoryUsage.used / 1024 / 1024)}MB / {Math.round(
							memoryUsage.available / 1024 / 1024
						)}MB
					</p>
				{/if}

				<!-- Warnings -->
				{#if generationState.warnings.length > 0}
					<div class="text-xs text-yellow-600 space-y-1">
						{#each generationState.warnings as warning}
							<p>⚠️ {warning}</p>
						{/each}
					</div>
				{/if}

				<!-- Error Display -->
				{#if generationState.error}
					<div class="text-xs text-red-600 p-2 bg-red-50 rounded">
						❌ {generationState.error}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action Buttons - Responsive Layout -->
	<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
		<!-- Background Generation Controls -->
		{#if isBackground}
			<div class="flex gap-2 w-full sm:w-auto">
				<Button variant="outline" onclick={handleCancel} size="sm">
					Stop Background Generation
				</Button>
			</div>
		{:else if isGenerating}
			<Button variant="outline" onclick={handleCancel} size="sm" class="w-full sm:w-auto">
				<LoadingIndicator operation="generation" message="Canceling..." />
			</Button>
		{/if}

		<!-- Main Generate Button -->
		<Button
			variant="outline"
			onclick={handleGenerate}
			disabled={isGenerating || collectionSize <= 0 || collectionSize > 10000}
			size="sm"
			class="w-full transition-all sm:w-auto"
		>
			{#if isGenerating}
				<LoadingIndicator operation="generation" message="Generating..." />
			{:else}
				<Play class="mr-2 h-4 w-4" />
				<span class="text-sm">Generate</span>
			{/if}
		</Button>

			</div>
</div>
