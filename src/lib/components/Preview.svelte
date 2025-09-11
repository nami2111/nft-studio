<script lang="ts">
	import { project } from '$lib/stores/runes-store';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { RefreshCw, Shuffle } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement | null = null;
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let container: HTMLDivElement | null = null;
	let displayWidth = 0;
	let displayHeight = 0;
	let isCanvasInitialized = $state(false);

	// Image cache using $state.raw since we don't need deep reactivity
	const imageCache = $state.raw(new SvelteMap<string, HTMLImageElement>());
	const cacheAccessTimes = $state.raw(new SvelteMap<string, number>());
	const MAX_CACHE_SIZE = 20; // Maximum number of images to cache

	// Helper to purge stale cache entries when traits change
	function purgeStaleCache() {
		const urlsInUse = new SvelteSet<string>();
		const { layers } = $project;
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
	let selectedTraitIds = $state(
		$project.layers.map((layer) => (layer.traits.length > 0 ? layer.traits[0].id : ''))
	);

	// Reset selected traits when project layers change
	$effect(() => {
		const { layers } = $project;
		const newSelectedTraits: string[] = [];

		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const currentSelectedId = selectedTraitIds[i];

			// If current selection exists in new layer, keep it, otherwise use first trait
			if (layer.traits.length > 0) {
				const traitExists = layer.traits.some((trait) => trait.id === currentSelectedId);
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
		layers: $project.layers,
		outputSize: $project.outputSize,
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

	// Load image with caching using worker
	async function loadImage(src: string): Promise<HTMLImageElement> {
		// Check if image is already in cache
		if (imageCache.has(src)) {
			cacheAccessTimes.set(src, Date.now());
			return imageCache.get(src)!;
		}

		// Check if this is a blob URL (starts with blob:)
		if (src.startsWith('blob:')) {
			// For blob URLs, load directly without using the worker
			return new Promise((resolve, reject) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = () => {
					imageCache.set(src, img);
					cacheAccessTimes.set(src, Date.now());
					resolve(img);
				};
				img.onerror = () => {
					console.error('Failed to load blob image');
					reject(new Error('Failed to load blob image'));
				};
				img.src = src;
			});
		}

		// For regular URLs, use the worker
		if (!imageWorker) throw new Error('Image worker not initialized');

		return new Promise((resolve, reject) => {
			const id = crypto.randomUUID();
			const handleMessage = (e: MessageEvent) => {
				if (e.data.id === id) {
					// Remove this specific handler
					imageWorker?.removeEventListener('message', handleMessage);
					messageHandlers.delete(id);

					if (e.data.error) {
						reject(new Error(e.data.error));
					} else {
						const img = new Image();
						img.crossOrigin = 'anonymous';
						img.onload = () => {
							imageCache.set(src, img);
							cacheAccessTimes.set(src, Date.now());
							resolve(img);
						};
						img.onerror = () => reject(new Error('Failed to load image from data URL'));
						img.src = e.data.dataUrl;
					}
				}
			};

			// Store the handler for proper cleanup
			messageHandlers.set(id, handleMessage);
			imageWorker?.addEventListener('message', handleMessage);
			imageWorker?.postMessage({ id, src });
		});
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

		const layers = $project.layers;
		const outputSize = $project.outputSize;

		// Check if project has valid output size
		if (outputSize.width <= 0 || outputSize.height <= 0) {
			// Draw placeholder text when no valid output size is set
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = '16px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(
				'Upload an image to set project dimensions',
				displayWidth / 2,
				displayHeight / 2
			);
			return;
		}

		// Check if there are any traits to display
		const hasTraits = layers.some((layer) => layer.traits.length > 0);
		if (!hasTraits) {
			// Draw placeholder text when no traits are uploaded yet
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = '16px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Upload images to see preview', displayWidth / 2, displayHeight / 2);
			return;
		}

		// Load and draw images in sequence to avoid memory spikes
		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const selectedTraitId = selectedTraitIds[i];

			// If no trait is selected for this layer, but the layer has traits, use the first one
			const effectiveTraitId =
				selectedTraitId || (layer.traits.length > 0 ? layer.traits[0].id : null);

			if (effectiveTraitId) {
				const selectedTrait = layer.traits.find((trait) => trait.id === effectiveTraitId);

				if (selectedTrait && selectedTrait.imageUrl) {
					try {
						const img = await loadImage(selectedTrait.imageUrl);
						try {
							ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
						} catch (drawError) {
							console.error('Error drawing image to canvas:', drawError);
							// Canvas context might be lost, try to reinitialize
							if (canvas) {
								const newCtx = canvas.getContext('2d');
								if (newCtx) {
									ctx = newCtx;

									// Try drawing again with new context
									ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
								}
							}
						}
					} catch (error) {
						console.error('Error drawing image:', error);
						// Only show error toast if we're not in the initial load state
						const isInitialLoad = layers.every((l) => l.traits.length === 0);
						if (!isInitialLoad) {
							// Show user-friendly error message
							import('svelte-sonner').then(({ toast }) => {
								toast.error('Failed to draw image in preview', {
									description: error instanceof Error ? error.message : 'Unknown error'
								});
							});
						}
					}
				}
			}
		}
	}

	// Effect for drawing when preview data changes
	$effect(() => {
		if (ctx && canvas && previewData) {
			purgeStaleCache();
			drawPreview().catch((error) => {
				console.error('Error in drawPreview:', error);
			});
		}
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

		const { outputSize } = $project;
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
		// Ensure we have a valid project state
		if (!$project || !$project.layers) {
			console.error('Cannot randomize: Project or layers not available');
			return;
		}
		const { layers } = $project;
		const newSelectedTraits: string[] = [];

		console.log('Project layers:', layers.length);
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

		// Ensure preview updates even if reactivity doesn't trigger
		requestAnimationFrame(() => {
			if (ctx && canvas && isCanvasInitialized) {
				drawPreview().catch((error) => {
					console.error('Error drawing preview after randomization:', error);
				});
			} else {
				// Try to initialize canvas if not ready
				if (canvas && container && !isCanvasInitialized) {
					const context = canvas.getContext('2d');
					if (context) {
						ctx = context;
						isCanvasInitialized = true;
						resizeCanvas();
						drawPreview().catch((error) => {
							console.error('Error drawing preview after initialization:', error);
						});
					}
				}
			}
		});
	}

	function handleRefresh() {
		if (ctx && canvas && previewData) {
			drawPreview().catch((error) => {
				console.error('Error refreshing preview:', error);
			});
		}
	}
</script>

<Card class="sticky top-4 sm:top-8">
	<CardContent class="p-4 sm:p-6">
		<h2 class="mb-3 text-lg font-bold text-gray-800 sm:mb-4 sm:text-xl">Preview</h2>
		<div
			bind:this={container}
			class="flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100 sm:h-96"
		>
			<canvas bind:this={canvas} class="block"></canvas>
		</div>
		<div class="mt-3 flex justify-center space-x-2 sm:mt-4">
			<Button size="sm" onclick={randomize}>
				<Shuffle class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
				<span class="text-xs sm:text-sm">Randomize</span>
			</Button>
			<Button variant="outline" size="sm" onclick={handleRefresh}>
				<RefreshCw class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
				<span class="text-xs sm:text-sm">Refresh</span>
			</Button>
		</div>
	</CardContent>
</Card>
