/**
 * Enhanced Resource Management with Advanced Caching
 * Handles object URLs, caching, and intelligent memory management
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
	private memoryPressureListener?: (event: Event) => void;
	private cleanupTimeout: number | null = null;
	private metricsCollectionInterval: number | null = null;
	private memoryPressureInterval: number | null = null;
	private componentCount = 0;
	private cleanupCallback: (() => void) | null = null;

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

		// Set up memory pressure event handling for proactive cleanup
		this.setupMemoryPressureHandling();

		// Set up periodic cache metrics collection
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
	 * Set up memory pressure event handling
	 */
	private setupMemoryPressureHandling(): void {
		if (typeof window === 'undefined') return;

		this.memoryPressureListener = () => {
			console.warn('Memory pressure detected, performing emergency cleanup');
			this.handleMemoryPressure();
		};

		// Listen for memory pressure events (supported in some browsers)
		if (typeof window !== 'undefined' && 'addEventListener' in window) {
			window.addEventListener('memorypressure', this.memoryPressureListener);

			// Also add a periodic cleanup check every 5 minutes
			this.memoryPressureInterval = window.setInterval(
				() => {
					this.performPeriodicCleanup();
				},
				5 * 60 * 1000
			);
		}
	}

	/**
	 * Handle memory pressure by evicting cached resources
	 */
	private handleMemoryPressure(): void {
		const currentUsage = this.getCacheMetrics().overall.totalMemoryUsage;

		// If using more than 100MB, start aggressive cleanup
		if (currentUsage > 100 * 1024 * 1024) {
			// Clean up some object URLs
			const urlsToClean = Math.min(this.objectUrls.size * 0.2, 50);
			const urlArray = Array.from(this.objectUrls).slice(0, urlsToClean);
			urlArray.forEach((url) => this.removeObjectUrl(url));

			console.warn('Memory pressure cleanup completed: aggressive');
		}
		// If using more than 50MB, do moderate cleanup
		else if (currentUsage > 50 * 1024 * 1024) {
			// Clean up fewer object URLs
			const urlsToClean = Math.min(this.objectUrls.size * 0.1, 25);
			const urlArray = Array.from(this.objectUrls).slice(0, urlsToClean);
			urlArray.forEach((url) => this.removeObjectUrl(url));

			console.warn('Memory pressure cleanup completed: moderate');
		}

		this.updateMetrics();
	}

	/**
	 * Perform periodic cleanup to prevent memory buildup
	 */
	private performPeriodicCleanup(): void {
		const currentUsage = this.getCacheMetrics().overall.totalMemoryUsage;

		// If using more than 20MB, perform light cleanup
		if (currentUsage > 20 * 1024 * 1024) {
			// Clean up some object URLs
			const urlsToClean = Math.min(this.objectUrls.size * 0.05, 10);
			const urlArray = Array.from(this.objectUrls).slice(0, urlsToClean);
			urlArray.forEach((url) => this.removeObjectUrl(url));

			this.updateMetrics();
		}
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
		// Clean up event listeners and intervals
		if (this.memoryPressureListener && typeof window !== 'undefined') {
			window.removeEventListener('memorypressure', this.memoryPressureListener);
			this.memoryPressureListener = undefined;
		}

		if (this.cleanupTimeout) {
			clearInterval(this.cleanupTimeout);
			this.cleanupTimeout = null;
		}

		if (this.memoryPressureInterval) {
			clearInterval(this.memoryPressureInterval);
			this.memoryPressureInterval = null;
		}

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
