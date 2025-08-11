<script lang="ts">
	import { project } from '$lib/stores/project/project.store';
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw, Shuffle } from 'lucide-svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

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

	// Store currently selected trait IDs for randomization
	let selectedTraitIds: string[] = [];

	// Initialize selected traits when component mounts or when layers change
	$: {
		const { layers } = $project;
		// If we don't have selected traits yet, or if the number of layers changed, update selection
		if (
			selectedTraitIds.length !== layers.length ||
			layers.some((layer, i) => {
				// Check if the currently selected trait still exists in the layer
				const selectedTraitId = selectedTraitIds[i];
				return selectedTraitId && !layer.traits.some((trait) => trait.id === selectedTraitId);
			})
		) {
			// Select first trait of each layer if available, or empty string if no traits
			selectedTraitIds = layers.map((layer) => (layer.traits.length > 0 ? layer.traits[0].id : ''));
		}
		// Only draw preview if we have a canvas context
		if (ctx && canvas) {
			drawPreview();
		}
	}

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

		drawPreview();
	}

	// Handle canvas initialization and resize
	$: if (canvas && container) {
		ctx = canvas.getContext('2d');
		resizeCanvas();
	}

	// Redraw when project changes
	$: if ($project) {
		// Purge cache entries that are no longer used to avoid holding stale images
		purgeStaleCache();
		resizeCanvas();
		// Force update of selected traits if needed
		const { layers } = $project;
		if (
			selectedTraitIds.length !== layers.length ||
			layers.some((layer, i) => {
				// Check if the currently selected trait still exists in the layer
				const selectedTraitId = selectedTraitIds[i];
				return selectedTraitId && !layer.traits.some((trait) => trait.id === selectedTraitId);
			})
		) {
			// Select first trait of each layer if available, or empty string if no traits
			selectedTraitIds = layers.map((layer) => (layer.traits.length > 0 ? layer.traits[0].id : ''));
		}
		drawPreview();
	}

	// Load image with caching
	async function loadImage(src: string): Promise<HTMLImageElement> {
		// Check if image is already in cache
		if (imageCache.has(src)) {
			return imageCache.get(src)!;
		}

		// Create new image and add to cache
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				imageCache.set(src, img);
				resolve(img);
			};
			img.onerror = () => {
				reject(new Error(`Failed to load image: ${src}`));
			};
			img.src = src;
		});
	}

	// Clear image cache when component is destroyed
	function clearImageCache() {
		imageCache.clear();
	}

	// Cleanup on component destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		clearImageCache();
	});

	async function drawPreview() {
		if (!ctx || !canvas) return;

		const { layers, outputSize } = $project;

		// Clear canvas
		ctx.clearRect(0, 0, displayWidth, displayHeight);

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

		// Draw each layer using selected traits
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

						// Draw image to fit canvas display dimensions
						ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
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

		// Update selected traits and redraw
		selectedTraitIds = newSelectedTraits;
		drawPreview();
	}
</script>

<div class="sticky top-8 rounded-lg bg-white p-6 shadow">
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
		<Button variant="outline" onclick={drawPreview}>
			<RefreshCw class="mr-2 h-4 w-4" />
			Refresh
		</Button>
	</div>
</div>
