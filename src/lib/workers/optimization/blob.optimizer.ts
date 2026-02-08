/**
 * OPTIMIZATION 2: Blob Processing Optimization
 * Batch and optimize blob creation for better throughput
 */
export class BlobProcessingOptimizer {
	private blobQueue: Array<{
		canvas: OffscreenCanvas;
		resolve: (blob: Blob) => void;
		reject: (error: Error) => void;
	}> = [];

	private processingPromise: Promise<void> | null = null;
	private batchSize = 5; // Process up to 5 blobs in parallel
	private totalTimeMs = 0;

	private stats = {
		totalBlobs: 0,
		batchedOperations: 0,
		averageTime: 0,
		qualityLevel: 0.9
	};

	/**
	 * Queue a canvas for blob conversion with batching
	 */
	async queueBlob(canvas: OffscreenCanvas, quality: number = 0.9): Promise<Blob> {
		this.stats.qualityLevel = quality;

		return new Promise((resolve, reject) => {
			this.blobQueue.push({ canvas, resolve, reject });
			void this.processBatch();
		});
	}

	/**
	 * Process queued blobs in batches for better throughput
	 */
	private async processBatch(): Promise<void> {
		if (this.processingPromise) {
			return this.processingPromise;
		}

		if (this.blobQueue.length === 0) {
			return;
		}

		this.processingPromise = (async () => {
			if (this.blobQueue.length < this.batchSize) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			while (this.blobQueue.length > 0) {
				const batch = this.blobQueue.splice(0, this.batchSize);
				const startTime = performance.now();

				const blobPromises = batch.map(async (item) => {
					try {
						const blob = await item.canvas.convertToBlob({
							type: 'image/png',
							quality: this.stats.qualityLevel
						});
						item.resolve(blob);
					} catch (error) {
						item.reject(error instanceof Error ? error : new Error('Blob conversion failed'));
					}
				});

				await Promise.all(blobPromises);

				const batchTime = performance.now() - startTime;
				this.totalTimeMs += batchTime;
				this.stats.totalBlobs += batch.length;
				this.stats.batchedOperations++;
				this.stats.averageTime =
					this.stats.totalBlobs > 0 ? this.totalTimeMs / this.stats.totalBlobs : 0;
			}
		})();

		try {
			await this.processingPromise;
		} finally {
			this.processingPromise = null;
			if (this.blobQueue.length > 0) {
				void this.processBatch();
			}
		}
	}

	/**
	 * Force immediate processing of remaining queued blobs
	 */
	async flush(): Promise<void> {
		while (this.blobQueue.length > 0 || this.processingPromise) {
			await this.processBatch();
		}
	}

	reset(): void {
		this.blobQueue = [];
		this.processingPromise = null;
		this.totalTimeMs = 0;
		this.stats.totalBlobs = 0;
		this.stats.batchedOperations = 0;
		this.stats.averageTime = 0;
	}

	getStats() {
		return {
			...this.stats,
			queuedBlobs: this.blobQueue.length,
			averageTimeMs: this.stats.averageTime.toFixed(2)
		};
	}
}
