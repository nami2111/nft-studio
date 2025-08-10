<script lang="ts">
	import { project } from '$lib/stores/project.store';
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw, Shuffle } from 'lucide-svelte';

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let container: HTMLDivElement | null = null;
	let displayWidth = 0;
	let displayHeight = 0;

	// Image cache to avoid reloading the same images repeatedly
	const imageCache = new Map<string, HTMLImageElement>();

	// Helper to purge stale cache entries when traits change
	function purgeStaleCache() {
		const urlsInUse = new Set<string>();
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

	// Initialize selected traits when component mounts
	$: {
		const { layers } = $project;
		selectedTraitIds = layers.map((layer) => (layer.traits.length > 0 ? layer.traits[0].id : ''));
		drawPreview();
	}

	// Function to resize canvas to fit container while maintaining aspect ratio
	function resizeCanvas() {
		if (!canvas || !container) return;

		const { outputSize } = $project;
		const containerRect = container.getBoundingClientRect();

		// Calculate display size based on container and project aspect ratio
		const aspectRatio = outputSize.width / outputSize.height;
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;

		// Calculate the maximum size that fits within container while maintaining aspect ratio
		if (containerWidth / containerHeight > aspectRatio) {
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
	import { onMount, onDestroy } from 'svelte';
	onDestroy(() => {
		clearImageCache();
	});

	async function drawPreview() {
		if (!ctx || !canvas) return;

		const { layers } = $project;

		// Clear canvas
		ctx.clearRect(0, 0, displayWidth, displayHeight);

		// Draw each layer using selected traits
		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const selectedTraitId = selectedTraitIds[i];

			if (selectedTraitId) {
				const selectedTrait = layer.traits.find((trait) => trait.id === selectedTraitId);
				if (selectedTrait && selectedTrait.imageUrl) {
					try {
						const img = await loadImage(selectedTrait.imageUrl);

						// Draw image to fit canvas display dimensions
						ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
					} catch (error) {
						console.error('Error drawing image:', error);
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
