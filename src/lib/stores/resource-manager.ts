/**
 * Resource management for object URLs and memory cleanup
 * Handles cleanup of Blob URLs and other resources to prevent memory leaks
 */

export class ResourceManager {
	private objectUrls = new Set<string>();

	/**
	 * Add an object URL to track for cleanup
	 */
	addObjectUrl(url: string): void {
		this.objectUrls.add(url);
	}

	/**
	 * Remove a specific object URL
	 */
	removeObjectUrl(url: string): void {
		if (this.objectUrls.has(url)) {
			URL.revokeObjectURL(url);
			this.objectUrls.delete(url);
		}
	}

	/**
	 * Clean up all tracked object URLs
	 */
	cleanup(): void {
		this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
		this.objectUrls.clear();
	}

	/**
	 * Get the number of tracked URLs
	 */
	get size(): number {
		return this.objectUrls.size;
	}

	/**
	 * Check if a URL is being tracked
	 */
	has(url: string): boolean {
		return this.objectUrls.has(url);
	}
}

// Singleton instance for global resource management
export const globalResourceManager = new ResourceManager();
