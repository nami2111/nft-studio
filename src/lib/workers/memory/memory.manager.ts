/**
 * Optimized memory pooling for sequential processing with size-bucketed caches.
 */
export class OptimizedMemoryManager {
	private canvasPools = new Map<string, OffscreenCanvas[]>();
	private objectUrlSet = new Set<string>(); // Track ObjectURLs for cleanup

	private maxPoolSize: number;
	private deviceMemoryGB: number;

	constructor() {
		this.deviceMemoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
		this.maxPoolSize = Math.min(this.deviceMemoryGB * 2, 10); // 2 canvases per GB, max 10
		if (import.meta.env.DEV)
			console.log(`🎯 Memory Manager: Max pool size ${this.maxPoolSize} canvases`);
	}

	private poolKey(width: number, height: number): string {
		return `${width}x${height}`;
	}

	getCanvas(width: number, height: number): OffscreenCanvas {
		// Try to reuse a same-size canvas from the bucketed pool
		const key = this.poolKey(width, height);
		const pool = this.canvasPools.get(key);
		if (pool && pool.length > 0) {
			return pool.pop()!;
		}

		return new OffscreenCanvas(width, height);
	}

	returnCanvas(canvas: OffscreenCanvas): void {
		const key = this.poolKey(canvas.width, canvas.height);

		if (!this.canvasPools.has(key)) {
			this.canvasPools.set(key, []);
		}

		const pool = this.canvasPools.get(key)!;
		if (pool.length < this.maxPoolSize) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			pool.push(canvas);
		}
	}

	getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
		const ctx = canvas.getContext('2d');
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
		const totalPooled = Array.from(this.canvasPools.values()).reduce(
			(sum, pool) => sum + pool.length,
			0
		);
		return {
			pooledCanvases: totalPooled,
			maxPoolSize: this.maxPoolSize,
			trackedUrls: this.objectUrlSet.size
		};
	}
}