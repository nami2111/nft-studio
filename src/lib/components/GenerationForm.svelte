<script lang="ts">
	// JSZip will be imported dynamically when needed
	import { project, loadingStates, startLoading, stopLoading } from '$lib/stores';
	import { startGeneration, cancelGeneration } from '$lib/domain/worker.service';
	import { Play } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
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

	// State
	let collectionSize = $state(100);
	let isGenerating = $derived(loadingStates['generation'] as boolean);
	let progress = $state(0);
	let statusText = $state('Ready to generate');
	let memoryUsage = $state<{ used: number; available: number; units: string } | null>(null);
	// Accumulators for chunked data
	let allImages: { name: string; imageData: ArrayBuffer }[] = [];
	let allMetadata: { name: string; data: Record<string, unknown> }[] = [];
	let previews = $state([] as { index: number; url: string }[]);
	// Track if we've started packaging to prevent duplicate calls
	let isPackaging = $state(false);
	// Track generation start time for analytics
	let generationStartTime = $state<number | null>(null);
	// Track if analytics event has been sent to prevent duplicates
	let analyticsTracked = $state(false);

	// Progress update function
	function updateProgress(
		generated: number,
		total: number,
		text: string,
		memory?: { used: number; available: number; units: string }
	) {
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
		memoryUsage = memory || null;
	}

	function resetState() {
		stopLoading('generation');
		updateProgress(0, 0, 'Ready to generate.');
		// Clear accumulators
		allImages = [];
		allMetadata = [];
		isPackaging = false;
		memoryUsage = null;
		generationStartTime = null;
		analyticsTracked = false;
		previews.forEach((p) => URL.revokeObjectURL(p.url));
		previews = [];
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
		};
		updateProgress(images.length, images.length, 'Packaging files into a .zip...');

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

			statusText = 'Download started.';
			showSuccess('Generation complete', {
				description: 'Your download has started and NFTs have been added to the gallery.'
			});
		} catch (error) {
			showError(error, {
				title: 'Package Error',
				description: 'Failed to create .zip file. Please try again.'
			});
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
			// Record generation start time for analytics
			generationStartTime = Date.now();

			const projectData = project as {
				name: string;
				outputSize: { width: number; height: number };
				description?: string;
				layers: Layer[];
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
			updateProgress(0, collectionSize, 'Validating project data...');

			// Set up a simple event system to handle messages from workers
			const workerMessageHandler = async (
				data: ProgressMessage | CompleteMessage | ErrorMessage | CancelledMessage | PreviewMessage
			) => {
				const message = data;

				switch (message.type) {
					case 'progress':
						updateProgress(
							message.payload.generatedCount,
							message.payload.totalCount,
							message.payload.statusText,
							message.payload.memoryUsage
						);
						break;
					case 'preview': {
						const { payload } = message as PreviewMessage;
						for (let j = 0; j < payload.indexes.length; j++) {
							const buffer = payload.previewData[j];
							const blob = new Blob([buffer], { type: 'image/png' });
							const url = URL.createObjectURL(blob);
							previews.push({ index: payload.indexes[j], url });
						}
						break;
					}
					case 'complete':
						// Handle chunked image data
						if (message.payload.images && message.payload.images.length > 0) {
							// This is a chunk of images, accumulate them
							allImages.push(...message.payload.images);
						}
						if (message.payload.metadata && message.payload.metadata.length > 0) {
							// This is a chunk of metadata, accumulate them
							allMetadata.push(
								...message.payload.metadata.map((meta) => ({
									name: meta.name,
									data: meta.data as Record<string, unknown>
								}))
							);
						}
						// If this is the final message (no more chunks expected)
						// In our new system, we'll know it's done when we've received all expected items
						if (allImages.length >= collectionSize || message.payload.images.length === 0) {
							console.log(
								'Generation complete, packaging:',
								allImages.length,
								'images,',
								allMetadata.length,
								'metadata'
							);

							// Track generation completion analytics (only once)
							if (generationStartTime && !analyticsTracked) {
								const durationSeconds = Math.round((Date.now() - generationStartTime) / 1000);
								trackGenerationCompleted(allImages.length, durationSeconds);
								analyticsTracked = true;
							}

							await packageZip(allImages, allMetadata);
						}
						break;
					case 'cancelled':
						updateProgress(
							message.payload.generatedCount ?? 0,
							message.payload.totalCount ?? collectionSize,
							'Generation cancelled by user.'
						);
						// Show info message for cancellation
						showInfo('Generation has been cancelled.');
						resetState();
						break;
					case 'error':
						showError(new Error(message.payload.message), {
							title: 'Generation Error',
							description: 'An error occurred during generation. Please try again.'
						});
						resetState();
						break;
					default:
						console.warn('Unknown message type from worker:', (message as { type: string }).type);
				}
			};

			// Start generation using the domain service
			await startGeneration(
				projectData.layers,
				collectionSize,
				projectData.outputSize,
				projectData.name,
				projectData.description || '',
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
		// Use the public cancel API to terminate all workers
		cancelGeneration();
		stopLoading('generation');
		updateProgress(0, collectionSize, 'Generation cancelled by user.');
		showInfo('Generation has been cancelled.');
		resetState();
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

		<!-- Progress Section - Responsive Layout -->
		<div class="grid gap-2 sm:grid-cols-[1fr_3fr] sm:items-center sm:gap-4">
			<label class="text-sm font-medium sm:text-right" for="gen-progress">Progress</label>
			<div class="space-y-2">
				<Progress value={progress} max={100} class="w-full" />
				<p class="text-muted-foreground text-sm break-words">{statusText}</p>
				{#if memoryUsage}
					<p class="text-muted-foreground text-sm">
						Memory: {Math.round(memoryUsage.used / 1024 / 1024)}MB / {Math.round(
							memoryUsage.available / 1024 / 1024
						)}MB
					</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Action Buttons - Responsive Layout -->
	<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
		{#if isGenerating}
			<Button variant="outline" onclick={handleCancel} size="sm" class="w-full sm:w-auto">
				<LoadingIndicator operation="generation" message="Canceling..." />
			</Button>
		{/if}
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
