<script lang="ts">
	import { project } from '$lib/stores';
	import type { Layer, Trait } from '$lib/types/layer';
	import type { TraitId } from '$lib/types/ids';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement | null = null;
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let container: HTMLDivElement | null = null;
	let displayWidth = 0;
	let displayHeight = 0;
	let isCanvasInitialized = $state(false);
	let isRandomizing = $state(false);
	let randomizeTimeoutId: number | null = null;

	// Image cache using $state.raw since we don't need deep reactivity
	const imageCache = $state.raw(new SvelteMap<string, HTMLImageElement>());
	const cacheAccessTimes = $state.raw(new SvelteMap<string, number>());
	const MAX_CACHE_SIZE = 20; // Maximum number of images to cache
	const RANDOMIZE_DEBOUNCE_MS = 150; // Debounce time for randomize button

	// Helper function to get responsive font size based on screen width
	function getPlaceholderFontSize(): string {
		return window.innerWidth < 640 ? '12px' : '16px';
	}

	// Helper to purge stale cache entries when traits change
	function purgeStaleCache() {
		const urlsInUse = new SvelteSet<string>();
		const { layers } = project;
		for (const layer of layers) {
			for (const trait of layer.traits) {
				if (trait.imageUrl) urlsInUse.add(trait.imageUrl);
			}
		}

		// Remove any cached images that are no longer referenced by current project traits
		for (const cachedUrl of imageCache.keys()) {
			if (!urlsInUse.has(cachedUrl)) {
				imageCache.delete(cachedUrl);
				cacheAccessTimes.delete(cachedUrl);
			}
		}

		// Enforce cache size limit using LRU strategy
		if (imageCache.size > MAX_CACHE_SIZE) {
			const entries = Array.from(cacheAccessTimes.entries());
			entries.sort((a, b) => a[1] - b[1]);

			// Remove oldest entries until we're under the limit
			for (let i = 0; i < entries.length - MAX_CACHE_SIZE; i++) {
				imageCache.delete(entries[i][0]);
				cacheAccessTimes.delete(entries[i][0]);
			}
		}
	}

	// Selected trait IDs state - starts with first trait of each layer
	let selectedTraitIds = $state<(TraitId | '')[]>(
		project.layers.map((layer: Layer) => (layer.traits.length > 0 ? layer.traits[0].id : ''))
	);

	// Reset selected traits when project layers change
	$effect(() => {
		const { layers } = project;
		const newSelectedTraits: (TraitId | '')[] = [];

		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const currentSelectedId = selectedTraitIds[i];

			// If current selection exists in new layer, keep it, otherwise use first trait
			if (layer.traits.length > 0) {
				const traitExists = layer.traits.some((trait: Trait) => trait.id === currentSelectedId);
				if (traitExists) {
					newSelectedTraits.push(currentSelectedId);
				} else {
					newSelectedTraits.push(layer.traits[0].id);
				}
			} else {
				newSelectedTraits.push('');
			}
		}

		// Only update if there's actually a change to prevent infinite loops

		if (JSON.stringify(newSelectedTraits) !== JSON.stringify(selectedTraitIds)) {
			// Use a temporary variable to break the reactivity cycle
			const updatedTraits = [...newSelectedTraits];
			selectedTraitIds = updatedTraits;
		}
	});

	// Derived preview data for memoization
	const previewData = $derived({
		layers: project.layers,
		outputSize: project.outputSize,
		selectedTraitIds
	});

	// Image worker for lazy loading with proper cleanup
	let imageWorker: Worker | null = null;
	const messageHandlers = new SvelteMap<string, (e: MessageEvent) => void>();

	$effect(() => {
		imageWorker = new Worker(new URL('../workers/image-loader.worker.ts', import.meta.url));

		return () => {
			// Clean up all message listeners
			for (const handler of messageHandlers.values()) {
				imageWorker?.removeEventListener('message', handler);
			}
			messageHandlers.clear();

			imageWorker?.terminate();
			imageWorker = null;
		};
	});

	// Component cleanup
	onDestroy(() => {
		// Clear any pending randomize timeout
		if (randomizeTimeoutId) {
			clearTimeout(randomizeTimeoutId);
			randomizeTimeoutId = null;
		}

		// Clear any pending preview update timeout
		if (previewUpdateTimeoutId) {
			clearTimeout(previewUpdateTimeoutId);
			previewUpdateTimeoutId = null;
		}

		// Clear image cache to free memory
		imageCache.clear();
		cacheAccessTimes.clear();

		// Clean up canvas context
		if (ctx) {
			// Clear canvas to free GPU memory
			if (canvas) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			// Release canvas context
			ctx = null;
		}

		// Clean up worker
		if (imageWorker) {
			for (const handler of messageHandlers.values()) {
				imageWorker.removeEventListener('message', handler);
			}
			messageHandlers.clear();
			imageWorker.terminate();
			imageWorker = null;
		}
	});

	// Track active image loading operations for cancellation
	const activeImageLoads = new SvelteMap<
		string,
		{ resolve: (value: HTMLImageElement) => void; reject: (reason: unknown) => void }
	>();

	// Helper function to validate blob URL before using it
	async function validateBlobUrl(blobUrl: string): Promise<boolean> {
		try {
			// Create a test fetch to check if blob URL is accessible
			const response = await fetch(blobUrl);
			return response.ok;
		} catch {
			return false;
		}
	}

	// Load image with caching using worker
	async function loadImage(src: string): Promise<HTMLImageElement> {
		// Check if image is already in cache
		if (imageCache.has(src)) {
			cacheAccessTimes.set(src, Date.now());
			return imageCache.get(src)!;
		}

		// Check if this is a blob URL (starts with blob:)
		if (src.startsWith('blob:')) {
			// First validate the blob URL to prevent browser errors
			const isValid = await validateBlobUrl(src);
			if (!isValid) {
				// Skip trying to load invalid blob URLs
				return Promise.reject(new Error('Blob URL no longer accessible'));
			}

			// Blob URL is valid, proceed with loading
			return new Promise((resolve, reject) => {
				const loadId = `${src}-${Date.now()}`;
				activeImageLoads.set(loadId, { resolve, reject });

				const img = new Image();
				// Don't set crossOrigin for blob URLs as it's not needed and might cause issues
				// img.crossOrigin = 'anonymous';

				// Set a timeout for blob URL loading to prevent hanging
				const timeoutId = setTimeout(() => {
					console.error(`Timeout loading blob URL: ${src}`);
					activeImageLoads.delete(loadId);
					if (imageCache.has(src)) {
						imageCache.delete(src);
						cacheAccessTimes.delete(src);
					}
					reject(new Error('Timeout loading blob image'));
				}, 5000); // 5 second timeout

				img.onload = () => {
					clearTimeout(timeoutId);
					activeImageLoads.delete(loadId);
					imageCache.set(src, img);
					cacheAccessTimes.set(src, Date.now());
					resolve(img);
				};
				img.onerror = () => {
					clearTimeout(timeoutId);
					activeImageLoads.delete(loadId);
					// Remove from cache if it was added somehow during error
					if (imageCache.has(src)) {
						imageCache.delete(src);
						cacheAccessTimes.delete(src);
					}
					reject(new Error('Failed to load blob image'));
				};
				img.src = src;
			});
		}

		// For regular URLs, use the worker
		if (!imageWorker) throw new Error('Image worker not initialized');

		return new Promise((resolve, reject) => {
			const id = crypto.randomUUID();
			const loadId = `${id}-${Date.now()}`;
			activeImageLoads.set(loadId, { resolve, reject });

			const handleMessage = (e: MessageEvent) => {
				if (e.data.id === id) {
					// Remove this specific handler
					imageWorker?.removeEventListener('message', handleMessage);
					messageHandlers.delete(id);
					activeImageLoads.delete(loadId);

					if (e.data.error) {
						reject(new Error(e.data.error));
					} else {
						const img = new Image();
						img.crossOrigin = 'anonymous';
						img.onload = () => {
							// Revoke object URL after image loads to free memory
							URL.revokeObjectURL(e.data.objectUrl);
							imageCache.set(src, img);
							cacheAccessTimes.set(src, Date.now());
							resolve(img);
						};
						img.onerror = () => {
							// Revoke object URL on error too
							URL.revokeObjectURL(e.data.objectUrl);
							// Remove from cache if it was added somehow during error
							if (imageCache.has(src)) {
								imageCache.delete(src);
								cacheAccessTimes.delete(src);
							}
							reject(new Error('Failed to load image from object URL'));
						};
						img.src = e.data.objectUrl;
					}
				}
			};

			// Store the handler for proper cleanup
			messageHandlers.set(id, handleMessage);
			imageWorker?.addEventListener('message', handleMessage);
			imageWorker?.postMessage({ id, src });
		});
	}

	// Cancel all active image loads (useful during rapid randomization)
	function cancelActiveImageLoads() {
		for (const [loadId, { reject }] of activeImageLoads) {
			reject(new Error('Image load cancelled due to new randomization'));
			activeImageLoads.delete(loadId);
		}
	}

	// Memoized drawPreview using current state
	async function drawPreview() {
		if (!ctx || !canvas) {
			return;
		}

		// Clear canvas
		try {
			ctx.clearRect(0, 0, displayWidth, displayHeight);
		} catch (error) {
			console.error('Error clearing canvas:', error);
			// Try to reinitialize canvas context
			if (canvas) {
				const newCtx = canvas.getContext('2d');
				if (newCtx) {
					ctx = newCtx;
				}
			}
			return;
		}

		const layers = project.layers;
		const outputSize = project.outputSize;

		// Check if project has valid output size
		if (outputSize.width <= 0 || outputSize.height <= 0) {
			// Draw placeholder text when no valid output size is set
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = `${getPlaceholderFontSize()} sans-serif`;
			ctx.textAlign = 'center';
			ctx.fillText(
				'Upload an image to set project dimensions',
				displayWidth / 2,
				displayHeight / 2
			);
			return;
		}

		// Check if there are any traits with valid image data to display
		const hasTraitsWithImageData = layers.some((layer: Layer) =>
			layer.traits.some((trait: Trait) => trait.imageData && trait.imageData.byteLength > 0)
		);

		// Check if project has traits but they're from persisted data (empty imageData)
		const hasTraitsWithoutImageData =
			layers.some((layer: Layer) => layer.traits.length > 0) && !hasTraitsWithImageData;

		if (hasTraitsWithoutImageData) {
			// Draw placeholder text for persisted projects that need image re-upload
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = `${getPlaceholderFontSize()} sans-serif`;
			ctx.textAlign = 'center';
			ctx.fillText('Project restored from cache', displayWidth / 2, displayHeight / 2 - 20);
			ctx.fillText(
				'Please re-upload your trait images to continue',
				displayWidth / 2,
				displayHeight / 2 + 10
			);
			return;
		}

		if (!hasTraitsWithImageData) {
			// Draw placeholder text when no traits are uploaded yet
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = `${getPlaceholderFontSize()} sans-serif`;
			ctx.textAlign = 'center';
			ctx.fillText('Upload images to see preview', displayWidth / 2, displayHeight / 2);
			return;
		}

		// Load all images in parallel for better performance
		const loadPromises = layers.map(async (layer: Layer, i: number) => {
			const selectedTraitId = selectedTraitIds[i];

			// If no trait is selected for this layer, but the layer has traits, use the first one
			const effectiveTraitId =
				selectedTraitId || (layer.traits.length > 0 ? layer.traits[0].id : null);

			if (effectiveTraitId) {
				const selectedTrait = layer.traits.find((trait: Trait) => trait.id === effectiveTraitId);
				if (selectedTrait) {
					// Check if trait has valid image data
					const hasValidImageData =
						selectedTrait.imageData && selectedTrait.imageData.byteLength > 0;

					// Skip traits without valid image data (e.g., from persisted projects)
					if (!hasValidImageData && !selectedTrait.imageUrl) {
						// Silently skip traits without image data (likely from persisted project)
						return null;
					}

					let imageUrl = selectedTrait.imageUrl;

					// Try to load with imageUrl first
					if (imageUrl) {
						try {
							const img = await loadImage(imageUrl);
							return { img, layerIndex: i };
						} catch (error) {
							// Try to recreate blob URL from imageData if imageUrl failed
							if (hasValidImageData) {
								try {
									const blob = new Blob([selectedTrait.imageData], { type: 'image/png' });
									imageUrl = URL.createObjectURL(blob);

									// Update the trait with the new URL
									selectedTrait.imageUrl = imageUrl;

									const img = await loadImage(imageUrl);
									return { img, layerIndex: i };
								} catch (recreateError) {
									console.error(
										`Failed to recreate image for trait ${selectedTrait.name}:`,
										recreateError
									);
								}
							}
						}
					} else if (hasValidImageData) {
						// No imageUrl but we have imageData, try to create blob URL
						try {
							const blob = new Blob([selectedTrait.imageData], { type: 'image/png' });
							imageUrl = URL.createObjectURL(blob);

							// Update the trait with the new URL
							selectedTrait.imageUrl = imageUrl;

							const img = await loadImage(imageUrl);
							return { img, layerIndex: i };
						} catch (createError) {
							console.error(`Failed to create image for trait ${selectedTrait.name}:`, createError);
						}
					}

					// If we get here, all loading attempts failed for a trait that should have data
					// Only show error if this isn't a persisted project (where all imageData is empty)
					const allTraitsHaveEmptyData = layers.every((l: Layer) =>
						l.traits.every((t: Trait) => !t.imageData || t.imageData.byteLength === 0)
					);

					if (!allTraitsHaveEmptyData) {
						console.error(
							`All attempts to load image failed for trait ${selectedTrait?.name || 'UNKNOWN'}`
						);
						// Show user-friendly error message only for non-persisted projects
						import('svelte-sonner').then(({ toast }) => {
							toast.error('Failed to load image in preview', {
								description: `Could not load ${selectedTrait?.name || 'trait'}`
							});
						});
					}
					return null;
				} else {
					console.warn(`Layer ${layer.name}: No trait found with ID ${effectiveTraitId}`);
				}
			}
			return null;
		});

		// Wait for all images to load, then draw them in layer order
		const loadedImages = await Promise.all(loadPromises);

		// Draw images in the correct order (by layer index)
		for (const result of loadedImages) {
			if (result && result.img) {
				try {
					ctx.drawImage(result.img, 0, 0, displayWidth, displayHeight);
				} catch (drawError) {
					console.error('Error drawing image to canvas:', drawError);
					// Canvas context might be lost, try to reinitialize
					if (canvas) {
						const newCtx = canvas.getContext('2d');
						if (newCtx) {
							ctx = newCtx;
							// Try drawing again with new context
							ctx.drawImage(result.img, 0, 0, displayWidth, displayHeight);
						}
					}
				}
			}
		}
	}

	// Preload adjacent traits for smoother user experience
	async function preloadAdjacentTraits() {
		const { layers } = project;
		const preloadPromises: Promise<HTMLImageElement | void>[] = [];

		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const currentTraitId = selectedTraitIds[i];

			if (layer.traits.length > 1 && currentTraitId) {
				const currentIndex = layer.traits.findIndex((trait: Trait) => trait.id === currentTraitId);
				if (currentIndex !== -1) {
					// Preload next trait
					const nextIndex = (currentIndex + 1) % layer.traits.length;
					const nextTrait = layer.traits[nextIndex];
					if (nextTrait && nextTrait.imageUrl && !imageCache.has(nextTrait.imageUrl)) {
						preloadPromises.push(
							loadImage(nextTrait.imageUrl).catch(() => {
								// Silently ignore preload failures
							})
						);
					}

					// Preload previous trait
					const prevIndex = currentIndex === 0 ? layer.traits.length - 1 : currentIndex - 1;
					const prevTrait = layer.traits[prevIndex];
					if (prevTrait && prevTrait.imageUrl && !imageCache.has(prevTrait.imageUrl)) {
						preloadPromises.push(
							loadImage(prevTrait.imageUrl).catch(() => {
								// Silently ignore preload failures
							})
						);
					}
				}
			}
		}

		// Limit concurrent preloads to avoid overwhelming the system
		const maxConcurrentPreloads = 4;
		for (let i = 0; i < preloadPromises.length; i += maxConcurrentPreloads) {
			const batch = preloadPromises.slice(i, i + maxConcurrentPreloads);
			await Promise.all(batch);
		}
	}

	// Clean up the image cache periodically to prevent accumulation during randomization
	function cleanupImageCache() {
		// More aggressive cleanup during randomization
		const aggressiveCleanupSize = Math.floor(MAX_CACHE_SIZE * 0.7); // Keep only 70% of max cache

		// Purge stale cache entries based on what's currently needed
		purgeStaleCache();

		// Force cleanup of least recently used items more aggressively
		if (imageCache.size > aggressiveCleanupSize) {
			const entries = Array.from(cacheAccessTimes.entries());
			entries.sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)

			// Remove oldest entries to get down to aggressive cleanup size
			const toRemove = imageCache.size - aggressiveCleanupSize;
			for (let i = 0; i < toRemove; i++) {
				const url = entries[i][0];
				if (imageCache.has(url)) {
					// Don't revoke blob URLs aggressively - let them be cleaned up naturally
					// This prevents ERR_FILE_NOT_FOUND errors
					imageCache.delete(url);
				}
				cacheAccessTimes.delete(url);
			}
		}
	}

	// Debounce timer for preview updates
	let previewUpdateTimeoutId: number | null = null;
	const PREVIEW_UPDATE_DEBOUNCE_MS = 200; // Increased debounce time for preview updates

	// Debounced preview update function
	function schedulePreviewUpdate() {
		// Clear any existing timeout
		if (previewUpdateTimeoutId) {
			clearTimeout(previewUpdateTimeoutId);
		}

		// Schedule a new preview update
		previewUpdateTimeoutId = setTimeout(async () => {
			if (ctx && canvas && isCanvasInitialized) {
				try {
					purgeStaleCache();
					await drawPreview();
					// Preload adjacent traits after main preview is drawn
					preloadAdjacentTraits();
					// Clean up image cache after drawing
					cleanupImageCache();
				} catch (error) {
					console.error('Error in debounced preview update:', error);
				}
			}
			previewUpdateTimeoutId = null;
		}, PREVIEW_UPDATE_DEBOUNCE_MS);
	}

	// Effect for drawing when preview data changes - now uses debouncing
	$effect(() => {
		// Only schedule preview update, don't draw immediately
		schedulePreviewUpdate();
	});

	// Handle canvas initialization and resize
	$effect(() => {
		if (canvas && container) {
			const context = canvas.getContext('2d');
			if (context) {
				ctx = context;
				isCanvasInitialized = true;
			} else {
				ctx = null;
				isCanvasInitialized = false;
			}
			resizeCanvas();
		}
	});

	// Function to resize canvas to fit container while maintaining aspect ratio
	function resizeCanvas() {
		if (!canvas || !container) return;

		const { outputSize } = project;
		const containerRect = container.getBoundingClientRect();

		// Calculate display size based on container and project aspect ratio
		// Handle case where outputSize is 0x0 (not yet set)
		const aspectRatio =
			outputSize.height !== 0 && outputSize.width !== 0 ? outputSize.width / outputSize.height : 1;
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;

		// Calculate the maximum size that fits within container while maintaining aspect ratio
		const containerAspectRatio = containerHeight !== 0 ? containerWidth / containerHeight : 1;
		if (containerAspectRatio > aspectRatio) {
			// Container is wider than needed - fit to height
			displayHeight = containerHeight;
			displayWidth = displayHeight * aspectRatio;
		} else {
			// Container is taller than needed - fit to width
			displayWidth = containerWidth;
			displayHeight = displayWidth / aspectRatio;
		}

		// Set canvas display size
		canvas.style.width = `${displayWidth}px`;
		canvas.style.height = `${displayHeight}px`;

		// Set canvas internal resolution to match display size for proper scaling
		const devicePixelRatio = window.devicePixelRatio || 1;
		canvas.width = displayWidth * devicePixelRatio;
		canvas.height = displayHeight * devicePixelRatio;

		if (ctx) {
			// Reset any previous transform before applying DPR scale to avoid compounding
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.scale(devicePixelRatio, devicePixelRatio);
		}
	}

	function randomize() {
		// Prevent multiple rapid randomizations
		if (isRandomizing) {
			return;
		}

		// Clear any existing timeout
		if (randomizeTimeoutId) {
			clearTimeout(randomizeTimeoutId);
		}

		// Set loading state
		isRandomizing = true;

		// Debounce the randomization to prevent rapid clicks
		randomizeTimeoutId = setTimeout(async () => {
			try {
				// Cancel any ongoing image loads to prevent conflicts
				cancelActiveImageLoads();

				// Ensure we have a valid project state
				if (!project || !project.layers) {
					console.error('Cannot randomize: Project or layers not available');
					return;
				}
				const { layers } = project;
				const newSelectedTraits: (TraitId | '')[] = [];

				for (const layer of layers) {
					if (layer.traits.length > 0) {
						// Select a random trait from this layer
						const randomIndex = Math.floor(Math.random() * layer.traits.length);
						const selectedTraitId = layer.traits[randomIndex].id;

						newSelectedTraits.push(selectedTraitId);
					} else {
						newSelectedTraits.push('');
					}
				}

				// Update selected traits - this will trigger $derived and effect
				selectedTraitIds = newSelectedTraits;

				// Aggressive cache cleanup before drawing new preview
				cleanupImageCache();

				// Schedule preview update instead of immediate draw to prevent excessive redraws
				schedulePreviewUpdate();
			} finally {
				// Reset loading state
				isRandomizing = false;
				randomizeTimeoutId = null;
			}
		}, RANDOMIZE_DEBOUNCE_MS);
	}

	function handleRefresh() {
		// Clear any pending preview update and schedule immediate refresh
		if (previewUpdateTimeoutId) {
			clearTimeout(previewUpdateTimeoutId);
			previewUpdateTimeoutId = null;
		}

		if (ctx && canvas && isCanvasInitialized) {
			drawPreview().catch((error) => {
				console.error('Error refreshing preview:', error);
			});
		}
	}
</script>

<Card class="sticky top-3 sm:top-4">
	<CardContent class="p-3 sm:p-4">
		<h2 class="mb-2 text-base font-bold sm:mb-3 sm:text-lg">Preview</h2>
		<div
			bind:this={container}
			class="border-input bg-muted flex aspect-square w-full max-w-full items-center justify-center overflow-hidden rounded-md border"
		>
			<canvas bind:this={canvas} class="block max-h-full max-w-full"></canvas>
		</div>
		<div
			class="mt-2 flex flex-col gap-2 sm:mt-3 sm:flex-row sm:justify-center sm:gap-0 sm:space-x-2"
		>
			<Button
				variant="outline"
				size="sm"
				onclick={randomize}
				disabled={isRandomizing}
				class="!hover:bg-primary !hover:text-primary-foreground w-full transition-all sm:w-auto"
			>
				<Shuffle class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4 {isRandomizing ? 'animate-spin' : ''}" />
				<span class="text-xs sm:text-sm">{isRandomizing ? 'Randomizing...' : 'Randomize'}</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={handleRefresh}
				class="!hover:bg-primary !hover:text-primary-foreground w-full transition-all sm:w-auto"
			>
				<RefreshCw class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
				<span class="text-xs sm:text-sm">Refresh</span>
			</Button>
		</div>
	</CardContent>
</Card>
