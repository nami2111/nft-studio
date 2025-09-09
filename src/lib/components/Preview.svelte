<script lang="ts">
	import { project } from '$lib/stores/runes-store';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { RefreshCw, Shuffle } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let container: HTMLDivElement | null = null;
	let displayWidth = 0;
	let displayHeight = 0;

	// Image cache to avoid reloading the same images repeatedly
	const imageCache = new SvelteMap<string, HTMLImageElement>();

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
			}
		}
	}

	// Derived selected trait IDs with memoization
	let selectedTraitIds = $derived($project.layers.map((layer: any) => layer.traits.length > 0 ? layer.traits[0].id : ''));

	// Derived preview data for memoization
	let previewData = $derived({
		layers: $project.layers,
		outputSize: $project.outputSize,
		selectedTraitIds
	});

	// Image worker for lazy loading
	let imageWorker: Worker | null = null;

	$effect(() => {
		imageWorker = new Worker(new URL('../workers/image-loader.worker.ts', import.meta.url));
		return () => {
			imageWorker?.terminate();
			imageWorker = null;
		};
	});

	// Load image with caching using worker
	async function loadImage(src: string): Promise<HTMLImageElement> {
		console.log('Attempting to load image via worker:', src);
		if (!imageWorker) throw new Error('Image worker not initialized');

		// Check if image is already in cache
		if (imageCache.has(src)) {
			console.log('Image found in cache:', src);
			return imageCache.get(src)!;
		}

		return new Promise((resolve, reject) => {
			const id = crypto.randomUUID();
			const handleMessage = (e: MessageEvent) => {
				if (e.data.id === id) {
					imageWorker?.removeEventListener('message', handleMessage);
					if (e.data.error) {
						reject(new Error(e.data.error));
					} else {
						const img = new Image();
						img.crossOrigin = 'anonymous';
						img.onload = () => {
							console.log('Image loaded successfully from worker:', src);
							imageCache.set(src, img);
							resolve(img);
						};
						img.onerror = () => reject(new Error('Failed to load image from data URL'));
						img.src = e.data.dataUrl;
					}
				}
			};
			imageWorker?.addEventListener('message', handleMessage);
			imageWorker?.postMessage({ id, src });
		});
	}

	// Clear image cache when component is destroyed
	function clearImageCache() {
		imageCache.clear();
	}

	// Cleanup on component destroy
	onDestroy(() => {
		clearImageCache();
		imageWorker?.terminate();
	});

	// Memoized drawPreview using derived data
	async function drawPreview(data: { layers: any[], outputSize: {width: number, height: number}, selectedTraitIds: string[] }) {
		if (!ctx || !canvas) return;

		console.log('drawPreview called with data:', data);

		// Clear canvas
		ctx.clearRect(0, 0, displayWidth, displayHeight);

		const { layers, outputSize } = data;

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
		const hasTraits = layers.some((layer: any) => layer.traits.length > 0);
		if (!hasTraits) {
			// Draw placeholder text when no traits are uploaded yet
			ctx.fillStyle = '#9ca3af'; // gray-400
			ctx.font = '16px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Upload images to see preview', displayWidth / 2, displayHeight / 2);
			return;
		}

		// Draw each layer using selected traits
		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const selectedTraitId = data.selectedTraitIds[i];

			// If no trait is selected for this layer, but the layer has traits, use the first one
			const effectiveTraitId =
				selectedTraitId || (layer.traits.length > 0 ? layer.traits[0].id : null);

			if (effectiveTraitId) {
				const selectedTrait = layer.traits.find((trait: any) => trait.id === effectiveTraitId);
				console.log('Trying to load trait:', selectedTrait);
				if (selectedTrait && selectedTrait.imageUrl) {
					console.log('Trait has imageUrl:', selectedTrait.imageUrl);
					try {
						const img = await loadImage(selectedTrait.imageUrl);

						// Draw image to fit canvas display dimensions
						ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
					} catch (error) {
						console.error('Error drawing image:', error);
						// Only show error toast if we're not in the initial load state
						const isInitialLoad = layers.every((l: any) => l.traits.length === 0);
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
			drawPreview(previewData).catch(error => {
				console.error('Error in drawPreview:', error);
			});
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

	// Handle canvas initialization and resize
	$effect(() => {
		if (canvas && container) {
			ctx = canvas.getContext('2d');
			resizeCanvas();
		}
	});

	// Redraw when project changes - now handled by $derived and $effect
	$effect(() => {
		if ($project) {
			purgeStaleCache();
			resizeCanvas();
		}
	});

	function randomize() {
		const { layers } = $project;
		const newSelectedTraits: string[] = [];

		for (const layer of layers) {
			if (layer.traits.length > 0) {
				// Select a random trait from this layer
				const randomIndex = Math.floor(Math.random() * layer.traits.length);
				newSelectedTraits.push(layer.traits[randomIndex].id);
			} else {
				newSelectedTraits.push('');
			}
		}

		// Update selected traits - this will trigger $derived and effect
		selectedTraitIds = newSelectedTraits;
	}

	function handleRefresh() {
		if (ctx && canvas && previewData) {
			drawPreview(previewData).catch(error => {
				console.error('Error refreshing preview:', error);
			});
		}
	}
</script>

<Card class="sticky top-8">
	<CardContent class="p-6">
		<h2 class="mb-4 text-xl font-bold text-gray-800">Preview</h2>
		<div
			bind:this={container}
			class="flex h-96 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100"
		>
			<canvas bind:this={canvas} class="block"></canvas>
		</div>
		<div class="mt-4 flex justify-center space-x-2">
			<Button onclick={randomize}>
				<Shuffle class="mr-2 h-4 w-4" />
				Randomize
			</Button>
			<Button variant="outline" onclick={handleRefresh}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Refresh
			</Button>
		</div>
	</CardContent>
</Card>