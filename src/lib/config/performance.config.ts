/**
 * Performance Configuration
 * Centralized configuration for all performance-related constants
 * Allows easy tuning and provides documentation for each setting
 */

export const PERF_CONFIG = {
	/**
	 * Batch Processing Configuration
	 * Balance between responsiveness and efficiency
	 */
	batch: {
		/**
		 * Batch delay in milliseconds
		 * - min: 100ms for small batches (fast response)
		 * - max: 1000ms for large batches (avoid blocking)
		 * - base: 50ms per item scaling
		 */
		delay: {
			min: 100, // Fast for small batches
			max: 1000, // Slow for large batches to avoid blocking
			base: 50 // ms per item
		},

		/**
		 * Default batch timeout in milliseconds
		 * Used for debouncing rapid state changes
		 */
		defaultTimeout: 1000
	},

	/**
	 * Caching Configuration
	 * Balance between memory usage and CPU savings
	 */
	cache: {
		/**
		 * Gallery filter cache settings
		 */
		galleryFilter: {
			maxEntries: 50, // Max filter combinations to remember
			maxMemoryMB: 100 // Max memory for cached results
		},

		/**
		 * Resource manager cache settings
		 * Three-tier caching system (ImageBitmap/ImageData/ArrayBuffer)
		 */
		resourceManager: {
			imageBitmap: {
				maxSizeMB: 100, // 100MB
				maxEntries: 500,
				ttlMinutes: 30
			},
			imageData: {
				maxSizeMB: 50, // 50MB
				maxEntries: 200,
				ttlMinutes: 15
			},
			arrayBuffer: {
				maxSizeMB: 200, // 200MB
				maxEntries: 1000,
				ttlMinutes: 60
			}
		}
	},

	/**
	 * Memory Management Configuration
	 * Control memory usage during batch processing
	 */
	memory: {
		/**
		 * Maximum images to keep in memory during batch processing
		 * Prevents browser from running out of memory
		 */
		maxImagesInMemory: 500,

		/**
		 * Warning thresholds for memory usage
		 */
		thresholds: {
			warnAtMB: 400, // Warn when reaching 400MB
			errorAtMB: 500, // Error at 500MB
			pressureCleanupThresholdMB: 50 // Start cleanup at 50MB
		}
	},

	/**
	 * Performance Monitoring Configuration
	 */
	monitoring: {
		/**
		 * Update interval for performance stats in milliseconds
		 */
		updateInterval: 1000,

		/**
		 * Default minutes for recent metrics
		 */
		defaultRecentMinutes: 5
	},

	/**
	 * File Operations Configuration
	 */
	fileOperations: {
		/**
		 * Maximum project file size in megabytes
		 */
		maxProjectSizeMB: 200,

		/**
		 * Retry settings for file operations
		 */
		retry: {
			maxAttempts: 3,
			delayMs: 150
		}
	},

	/**
	 * Generation Configuration
	 */
	generation: {
		/**
		 * Batched progress update intervals
		 */
		progress: {
			updateInterval: 100, // Update UI every N items
			maxDelayMs: 5000, // 5 second max delay
			saveIntervalMs: 30000 // Save state every 30 seconds
		},

		/**
		 * Worker pool settings
		 */
		workers: {
			maxWorkers: 8, // Max 8 workers
			cpuUtilization: 0.75, // Use 75% of available cores
			memoryPerWorkerMB: 512 // 512MB per worker
		}
	},

	/**
	 * Gallery Configuration
	 */
	gallery: {
		/**
		 * Virtual scrolling settings for large lists
		 */
		virtualScrolling: {
			estimatedItemHeight: 250, // px
			viewportMargin: 50 // px
		},

		/**
		 * Natural sorting configuration
		 */
		naturalSort: {
			// Number extraction patterns
			patterns: [
				/(?:[#\-\s:_]\s*)(\d+)/, // Numbers after delimiters
				/^(\d+)/ // Numbers at start
			]
		}
	},

	/**
	 * UI/UX Configuration
	 */
	ui: {
		/**
		 * Loading state minimum display time
		 * Prevents flickering for fast operations
		 */
		loadingMinDisplayMs: 300,

		/**
		 * Toast notification duration
		 */
		toastDuration: 3000
	}
} as const;

/**
 * Type helper for performance config
 */
export type PerformanceConfig = typeof PERF_CONFIG;

/**
 * Get optimal batch size based on collection size
 */
export function getOptimalBatchSize(collectionSize: number): number {
	if (collectionSize <= 1000) {
		return 25; // More frequent updates for small collections
	} else if (collectionSize <= 10000) {
		return 50; // Medium frequency for medium collections
	} else {
		return 100; // Less frequent for large collections
	}
}

/**
 * Calculate adaptive batch delay based on queue size
 */
export function calculateAdaptiveDelay(queueSize: number, config: typeof PERF_CONFIG.batch.delay = PERF_CONFIG.batch.delay): number {
	return Math.min(
		config.max,
		Math.max(config.min, queueSize * config.base)
	);
}

/**
 * Get optimal worker count based on device capabilities
 */
export function getOptimalWorkerCount(maxWorkers = PERF_CONFIG.generation.workers.maxWorkers): number {
	if (typeof navigator === 'undefined') return 4;

	const cores = navigator.hardwareConcurrency || 4;
	// deviceMemory is experimental - use type assertion
	const memoryGB = (navigator as any).deviceMemory || 4;

	// Use configured CPU utilization, capped by memory
	const byCores = Math.floor(cores * PERF_CONFIG.generation.workers.cpuUtilization);
	const byMemory = Math.floor(memoryGB * 2); // 2 workers per GB

	return Math.min(byCores, byMemory, maxWorkers);
}

/**
 * Get the performance configuration
 * Allows dynamic configuration access for monitoring and testing
 */
export function getPerformanceConfig(): PerformanceConfig {
	return PERF_CONFIG;
}
