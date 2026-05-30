/**
 * Enhanced Resource Management with Advanced Caching
 * Handles object URLs, caching, and intelligent memory management.
 *
 * Memory pressure detection is delegated to {@link MemoryPressureMonitor}.
 * This class owns the caches and the cleanup policy; the monitor decides when.
 */

import { MEMORY, TIME } from '$lib/config/constants';
import {
	ArrayBufferCache,
	type CacheMetrics,
	ImageBitmapCache,
	ImageDataCache
} from '$lib/utils/advanced-cache';
import { formatFileSize } from '$lib/utils/formatters';
import { performanceMonitor } from '$lib/utils/performance-monitor';
import { type CleanupIntensity, MemoryPressureMonitor } from './memory-pressure-monitor';

export interface CacheConfig {
	imageBitmap?: {
		maxSize?: number;
		maxEntries?: number;
		ttl?: number;
	};
	imageData?: {
		maxSize?: number;
		maxEntries?: number;
		ttl?: number;
	};
	arrayBuffer?: {
		maxSize?: number;
		maxEntries?: number;
		ttl?: number;
	};
}

export class ResourceManager {
	private objectUrls = new Set<string>();
	private imageBitmapCache: ImageBitmapCache;
	private imageCache: ImageDataCache;
	private arrayBufferCache: ArrayBufferCache;
	private metrics = {
		objectUrls: 0,
		cacheHits: 0,
		cacheMisses: 0,
		memoryUsage: 0
	};
	private pressureMonitor: MemoryPressureMonitor;
	private metricsCollectionInterval: number | null = null;
	private componentCount = 0;

	constructor(config: CacheConfig = {}) {
		// Initialize specialized caches with optimized defaults
		this.imageBitmapCache = new ImageBitmapCache({
			maxSize: config.imageBitmap?.maxSize || MEMORY.IMAGE_BITMAP_CACHE_MAX_SIZE,
			maxEntries: config.imageBitmap?.maxEntries || MEMORY.IMAGE_BITMAP_CACHE_MAX_ENTRIES,
			defaultTtl: config.imageBitmap?.ttl || MEMORY.IMAGE_BITMAP_CACHE_TTL,
			evictionPolicy: 'lru'
		});

		this.imageCache = new ImageDataCache({
			maxSize: config.imageData?.maxSize || MEMORY.IMAGE_DATA_CACHE_MAX_SIZE,
			maxEntries: config.imageData?.maxEntries || MEMORY.IMAGE_DATA_CACHE_MAX_ENTRIES,
			defaultTtl: config.imageData?.ttl || MEMORY.IMAGE_DATA_CACHE_TTL,
			evictionPolicy: 'lru'
		});

		this.arrayBufferCache = new ArrayBufferCache({
			maxSize: config.arrayBuffer?.maxSize || MEMORY.ARRAY_BUFFER_CACHE_MAX_SIZE,
			maxEntries: config.arrayBuffer?.maxEntries || MEMORY.ARRAY_BUFFER_CACHE_MAX_ENTRIES,
			defaultTtl: config.arrayBuffer?.ttl || TIME.BUFFER_CACHE_TTL,
			evictionPolicy: 'lru'
		});

		// Delegate pressure detection to monitor — this class owns the cleanup policy
		this.pressureMonitor = new MemoryPressureMonitor({
			getCurrentUsageBytes: () => this.getCacheMetrics().overall.totalMemoryUsage,
			onCleanup: (intensity) => this.handlePressureCleanup(intensity)
		});
		this.pressureMonitor.start();

		this.setupCacheMetricsCollection();
	}

	/**
	 * Bind this ResourceManager to a component lifecycle
	 * Call onMount in your component and pass the returned cleanup function to onDestroy
	 */
	setupLifecycle(onDestroy: () => void): () => void {
		this.componentCount++;
		return () => {
			onDestroy();
			this.componentCount--;
			// If no components remain, perform cleanup
			if (this.componentCount <= 0) {
				this.performFullCleanup();
			}
		};
	}

	/**
	 * Perform full cleanup when last component unmounts
	 */
	private performFullCleanup(): void {
		if (import.meta.env.DEV)
			console.info('No components remaining, performing full resource cleanup');
		this.cleanup();
	}

	/**
	 * Handle cleanup at varying intensity. Triggered by MemoryPressureMonitor.
	 * Owns the policy: how many object URLs to evict at each level.
	 */
	private handlePressureCleanup(intensity: CleanupIntensity): void {
		const fraction = intensity === 'aggressive' ? 0.2 : intensity === 'moderate' ? 0.1 : 0.05;
		const cap = intensity === 'aggressive' ? 50 : intensity === 'moderate' ? 25 : 10;

		const urlsToClean = Math.min(this.objectUrls.size * fraction, cap);
		const urlArray = Array.from(this.objectUrls).slice(0, urlsToClean);
		urlArray.forEach((url) => this.removeObjectUrl(url));

		if (intensity !== 'light') {
			console.warn(`Memory pressure cleanup completed: ${intensity}`);
		}
		this.updateMetrics();
	}

	/**
	 * Set up periodic cache metrics collection for performance monitoring
	 */
	private setupCacheMetricsCollection(): void {
		// Collect cache metrics every 30 seconds
		this.metricsCollectionInterval = window.setInterval(() => {
			this.collectAndReportCacheMetrics();
		}, 30 * 1000);

		// Also collect metrics immediately
		window.setTimeout(() => {
			this.collectAndReportCacheMetrics();
		}, 5 * 1000); // Initial collection after 5 seconds
	}

	/**
	 * Collect cache metrics and report to performance monitor
	 */
	private collectAndReportCacheMetrics(): void {
		try {
			const bitmapMetrics = this.imageBitmapCache.getMetrics();
			const imageMetrics = this.imageCache.getMetrics();
			const bufferMetrics = this.arrayBufferCache.getMetrics();

			// Convert cache metrics to the format expected by performance monitor
			if (bitmapMetrics) {
				performanceMonitor.addCacheMetrics('imageBitmap', bitmapMetrics as CacheMetrics);
			}
			if (imageMetrics) {
				performanceMonitor.addCacheMetrics('imageData', imageMetrics as CacheMetrics);
			}
			if (bufferMetrics) {
				performanceMonitor.addCacheMetrics('arrayBuffer', bufferMetrics as CacheMetrics);
			}
		} catch (error) {
			console.warn('Failed to collect cache metrics:', error);
		}
	}

	/**
	 * Add an object URL to track for cleanup
	 */
	addObjectUrl(url: string): void {
		this.objectUrls.add(url);
		this.metrics.objectUrls = this.objectUrls.size;
	}

	/**
	 * Remove a specific object URL
	 */
	removeObjectUrl(url: string): void {
		if (this.objectUrls.has(url)) {
			URL.revokeObjectURL(url);
			this.objectUrls.delete(url);
			this.metrics.objectUrls = this.objectUrls.size;
		}
	}

	/**
	 * Clean up all tracked object URLs and perform cache cleanup
	 */
	cleanup(): void {
		// Clean up object URLs
		this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.objectUrls.clear();
		this.metrics.objectUrls = 0;

		// Clear all caches
		this.imageBitmapCache.clear();
		this.imageCache.clear();
		this.arrayBufferCache.clear();

		// Update metrics
		this.updateMetrics();
	}

	/**
	 * Destroy all resources and caches
	 */
	destroy(): void {
		this.pressureMonitor.stop();

		if (this.metricsCollectionInterval) {
			clearInterval(this.metricsCollectionInterval);
			this.metricsCollectionInterval = null;
		}

		// Clean up all resources
		this.cleanup();

		// Destroy all caches
		this.imageBitmapCache.destroy();
		this.imageCache.destroy();
		this.arrayBufferCache.destroy();
	}

	// ============= ImageBitmap Caching =============

	/**
	 * Cache an ImageBitmap
	 */
	cacheImageBitmap(key: string, bitmap: ImageBitmap, ttl?: number): void {
		this.imageBitmapCache.set(key, bitmap, ttl);
		this.updateMetrics();
	}

	/**
	 * Get cached ImageBitmap
	 */
	getCachedImageBitmap(key: string): ImageBitmap | undefined {
		const result = this.imageBitmapCache.get(key);
		if (result) {
			this.metrics.cacheHits++;
		} else {
			this.metrics.cacheMisses++;
		}
		this.updateMetrics();
		return result;
	}

	/**
	 * Check if ImageBitmap is cached
	 */
	hasCachedImageBitmap(key: string): boolean {
		return this.imageBitmapCache.has(key);
	}

	/**
	 * Remove cached ImageBitmap
	 */
	removeCachedImageBitmap(key: string): boolean {
		return this.imageBitmapCache.delete(key);
	}

	// ============= ImageData Caching =============

	/**
	 * Cache ImageData
	 */
	cacheImageData(key: string, imageData: ImageData, ttl?: number): void {
		this.imageCache.set(key, imageData, ttl);
		this.updateMetrics();
	}

	/**
	 * Get cached ImageData
	 */
	getCachedImageData(key: string): ImageData | undefined {
		const result = this.imageCache.get(key);
		if (result) {
			this.metrics.cacheHits++;
		} else {
			this.metrics.cacheMisses++;
		}
		this.updateMetrics();
		return result;
	}

	/**
	 * Check if ImageData is cached
	 */
	hasCachedImageData(key: string): boolean {
		return this.imageCache.has(key);
	}

	/**
	 * Remove cached ImageData
	 */
	removeCachedImageData(key: string): boolean {
		return this.imageCache.delete(key);
	}

	// ============= ArrayBuffer Caching =============

	/**
	 * Cache ArrayBuffer
	 */
	cacheArrayBuffer(key: string, buffer: ArrayBuffer, ttl?: number): void {
		this.arrayBufferCache.set(key, buffer, ttl);
		this.updateMetrics();
	}

	/**
	 * Get cached ArrayBuffer
	 */
	getCachedArrayBuffer(key: string): ArrayBuffer | undefined {
		const result = this.arrayBufferCache.get(key);
		if (result) {
			this.metrics.cacheHits++;
		} else {
			this.metrics.cacheMisses++;
		}
		this.updateMetrics();
		return result;
	}

	/**
	 * Check if ArrayBuffer is cached
	 */
	hasCachedArrayBuffer(key: string): boolean {
		return this.arrayBufferCache.has(key);
	}

	/**
	 * Remove cached ArrayBuffer
	 */
	removeCachedArrayBuffer(key: string): boolean {
		return this.arrayBufferCache.delete(key);
	}

	// ============= Utility Methods =============

	/**
	 * Clear all caches
	 */
	clearCaches(): void {
		this.imageBitmapCache.clear();
		this.imageCache.clear();
		this.arrayBufferCache.clear();
		this.updateMetrics();
	}

	/**
	 * Cleanup expired entries
	 */
	cleanupExpired(): number {
		const bitmapCleaned = this.imageBitmapCache.cleanup();
		const imageCleaned = this.imageCache.cleanup();
		const bufferCleaned = this.arrayBufferCache.cleanup();
		this.updateMetrics();
		return bitmapCleaned + imageCleaned + bufferCleaned;
	}

	/**
	 * Get cache metrics
	 */
	getCacheMetrics(): {
		imageBitmap: CacheMetrics;
		imageData: CacheMetrics;
		arrayBuffer: CacheMetrics;
		overall: {
			totalHits: number;
			totalMisses: number;
			totalMemoryUsage: number;
			totalEntries: number;
			overallHitRate: number;
		};
	} {
		const imageBitmapMetrics = this.imageBitmapCache.getMetrics();
		const imageDataMetrics = this.imageCache.getMetrics();
		const arrayBufferMetrics = this.arrayBufferCache.getMetrics();

		const totalHits = imageBitmapMetrics.hits + imageDataMetrics.hits + arrayBufferMetrics.hits;
		const totalMisses =
			imageBitmapMetrics.misses + imageDataMetrics.misses + arrayBufferMetrics.misses;
		const totalMemoryUsage =
			imageBitmapMetrics.memoryUsage +
			imageDataMetrics.memoryUsage +
			arrayBufferMetrics.memoryUsage;
		const totalEntries =
			imageBitmapMetrics.currentEntries +
			imageDataMetrics.currentEntries +
			arrayBufferMetrics.currentEntries;

		return {
			imageBitmap: imageBitmapMetrics,
			imageData: imageDataMetrics,
			arrayBuffer: arrayBufferMetrics,
			overall: {
				totalHits,
				totalMisses,
				totalMemoryUsage,
				totalEntries,
				overallHitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0
			}
		};
	}

	/**
	 * Get memory usage summary
	 */
	getMemorySummary(): {
		totalUsage: string;
		byCache: {
			imageBitmap: string;
			imageData: string;
			arrayBuffer: string;
		};
		objectUrls: number;
	} {
		const metrics = this.getCacheMetrics();

		return {
			totalUsage: formatFileSize(metrics.overall.totalMemoryUsage),
			byCache: {
				imageBitmap: this.imageBitmapCache.getMemoryUsage(),
				imageData: this.imageCache.getMemoryUsage(),
				arrayBuffer: this.arrayBufferCache.getMemoryUsage()
			},
			objectUrls: this.metrics.objectUrls
		};
	}

	/**
	 * Update internal metrics
	 */
	private updateMetrics(): void {
		const cacheMetrics = this.getCacheMetrics();
		this.metrics.memoryUsage = cacheMetrics.overall.totalMemoryUsage;
	}

	/**
	 * Get the number of tracked URLs (legacy compatibility)
	 */
	get size(): number {
		return this.objectUrls.size;
	}

	/**
	 * Check if a URL is being tracked (legacy compatibility)
	 */
	has(url: string): boolean {
		return this.objectUrls.has(url);
	}
}

// Singleton instance for global resource management
export const globalResourceManager = new ResourceManager();
