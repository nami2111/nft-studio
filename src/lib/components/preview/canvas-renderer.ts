/**
 * Canvas rendering functionality for preview component
 * Handles drawing and resizing of the preview canvas
 */

import type { Layer } from '$lib/types/layer';
import type { TraitId } from '$lib/types/ids';
import { ImageCache } from './image-cache';

export class CanvasRenderer {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private container: HTMLDivElement | null = null;
	private imageCache: ImageCache;
	private isInitialized = false;

	constructor(imageCache: ImageCache) {
		this.imageCache = imageCache;
	}

	/**
	 * Initialize canvas and container references
	 */
	initialize(canvas: HTMLCanvasElement, container: HTMLDivElement): void {
		this.canvas = canvas;
		this.container = container;
		this.ctx = canvas.getContext('2d');
		this.isInitialized = true;
	}

	/**
	 * Check if canvas is initialized
	 */
	get initialized(): boolean {
		return this.isInitialized;
	}

	/**
	 * Resize canvas to fit container while maintaining aspect ratio
	 */
	resize(outputWidth: number, outputHeight: number): void {
		if (!this.canvas || !this.container) return;

		const containerRect = this.container.getBoundingClientRect();
		const aspectRatio = outputWidth / outputHeight;
		const containerWidth = containerRect.width;
		const containerHeight = containerRect.height;
		const containerAspectRatio = containerHeight !== 0 ? containerWidth / containerHeight : 1;

		let displayWidth: number;
		let displayHeight: number;

		if (containerAspectRatio > aspectRatio) {
			// Container is wider than needed
			displayHeight = containerHeight;
			displayWidth = displayHeight * aspectRatio;
		} else {
			// Container is taller than needed
			displayWidth = containerWidth;
			displayHeight = displayWidth / aspectRatio;
		}

		const devicePixelRatio = window.devicePixelRatio || 1;
		this.canvas.width = displayWidth * devicePixelRatio;
		this.canvas.height = displayHeight * devicePixelRatio;
		this.canvas.style.width = `${displayWidth}px`;
		this.canvas.style.height = `${displayHeight}px`;

		if (this.ctx) {
			this.ctx.scale(devicePixelRatio, devicePixelRatio);
		}
	}

	/**
	 * Draw preview by composing selected traits
	 */
	async drawPreview(
		layers: Layer[],
		outputWidth: number,
		outputHeight: number,
		selectedTraitIds: (TraitId | '')[]
	): Promise<void> {
		if (!this.ctx || !this.canvas) return;

		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Check if we have any traits to draw
		const hasTraits = layers.some((layer) => layer.traits.length > 0);
		if (!hasTraits) return;

		// Load and draw each layer
		const loadPromises = layers.map(async (layer, i) => {
			const selectedTraitId = selectedTraitIds[i];

			// Handle empty selections
			if (!selectedTraitId || layer.traits.length === 0) {
				return null;
			}

			// Find the selected trait
			const selectedTrait = layer.traits.find((trait) => trait.id === selectedTraitId);
			if (!selectedTrait || !selectedTrait.imageUrl) {
				return null;
			}

			// Load image from cache or fetch it
			let img = this.imageCache.get(selectedTrait.imageUrl);
			if (!img) {
				img = await this.loadImage(selectedTrait.imageUrl);
				if (img) {
					this.imageCache.set(selectedTrait.imageUrl, img);
				}
			}

			return img;
		});

		// Wait for all images to load
		const loadedImages = await Promise.all(loadPromises);

		// Get updated context after async operations
		const ctx = this.canvas.getContext('2d');
		if (!ctx) return;

		// Draw each image
		loadedImages.forEach((img) => {
			if (img) {
				ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
			}
		});
	}

	/**
	 * Load an image from URL
	 */
	private async loadImage(src: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
			img.src = src;
		});
	}

	/**
	 * Clear the canvas
	 */
	clear(): void {
		if (this.ctx && this.canvas) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}

	/**
	 * Get canvas context for external use
	 */
	get context(): CanvasRenderingContext2D | null {
		return this.ctx;
	}

	/**
	 * Get canvas element for external use
	 */
	get element(): HTMLCanvasElement | null {
		return this.canvas;
	}
}
