/**
 * Optimized memory pooling for sequential processing
 */
export class OptimizedMemoryManager {
	private canvasPool: OffscreenCanvas[] = [];
	private ctxPool: OffscreenCanvasRenderingContext2D[] = [];
	private objectUrlSet = new Set<string>(); // Track ObjectURLs for cleanup

	private maxPoolSize: number;
	private deviceMemoryGB: number;

	constructor() {
		this.deviceMemoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
		this.maxPoolSize = Math.min(this.deviceMemoryGB * 2, 10); // 2 canvases per GB, max 10
		console.log(`🎯 Memory Manager: Max pool size ${this.maxPoolSize} canvases`);
	}

	getCanvas(width: number, height: number): OffscreenCanvas {
		// Try to reuse a canvas from the pool
		let canvas = this.canvasPool.pop();

		if (!canvas || canvas.width !== width || canvas.height !== height) {
			canvas = new OffscreenCanvas(width, height);
		}

		return canvas;
	}

	returnCanvas(canvas: OffscreenCanvas): void {
		if (this.canvasPool.length < this.maxPoolSize) {
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			this.canvasPool.push(canvas);
		}
	}

	getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) {
			throw new Error('Failed to get 2D context');
		}
		return ctx;
	}

	trackObjectUrl(url: string): void {
		this.objectUrlSet.add(url);
	}

	cleanupObjectUrls(): void {
		for (const url of this.objectUrlSet) {
			URL.revokeObjectURL(url);
		}
		this.objectUrlSet.clear();
	}

	get poolStats() {
		return {
			pooledCanvases: this.canvasPool.length,
			maxPoolSize: this.maxPoolSize,
			trackedUrls: this.objectUrlSet.size
		};
	}
}
