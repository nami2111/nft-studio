/**
 * Resource Manager — tracks object URLs for cleanup.
 *
 * Formerly hosted an AdvancedCache<T> hierarchy + MemoryPressureMonitor +
 * periodic metrics collection. All of that was dead: no prod code ever called
 * the cache methods, so memory usage was always 0, so the pressure monitor
 * never fired, and the metrics it collected were never read.
 *
 * What survives is the object-URL tracking that's actually used:
 * `addObjectUrl`, `removeObjectUrl`, `cleanup`, `destroy`.
 */

export class ResourceManager {
	private objectUrls = new Set<string>();

	/**
	 * Add an object URL to track for cleanup.
	 */
	addObjectUrl(url: string): void {
		this.objectUrls.add(url);
	}

	/**
	 * Remove a specific object URL and revoke it.
	 */
	removeObjectUrl(url: string): void {
		if (this.objectUrls.has(url)) {
			URL.revokeObjectURL(url);
			this.objectUrls.delete(url);
		}
	}

	/**
	 * Clean up all tracked object URLs.
	 */
	cleanup(): void {
		this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.objectUrls.clear();
	}

	/**
	 * Destroy all resources. Same as cleanup — kept for API compat.
	 */
	destroy(): void {
		this.cleanup();
	}

	/**
	 * Get the number of tracked URLs.
	 */
	get size(): number {
		return this.objectUrls.size;
	}

	/**
	 * Check if a URL is being tracked.
	 */
	has(url: string): boolean {
		return this.objectUrls.has(url);
	}
}

// Singleton instance for global resource management.
export const globalResourceManager = new ResourceManager();
