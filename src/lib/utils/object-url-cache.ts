/**
 * Cache for managing image URLs with fallback to data URLs for large collections
 * Prevents memory leaks and blob URL issues by using data URLs for large collections
 *
 * Optimized for handling large NFT collections (10K+ items) with:
 * - Data URLs for collections > 1000 items (eliminates blob URL issues)
 * - ObjectURLs for smaller collections (better performance)
 * - Automatic fallback based on collection size
 * - Memory-efficient caching with size limits
 */

export class ObjectUrlCache {
	private cache = new Map<
		string,
		{ url: string; type: 'blob' | 'dataurl'; size: number; lastAccessed: number; revoked?: boolean }
	>();
	private retryAttempts = new Map<string, number>();
	private maxSize: number;
	private maxMemory: number; // in bytes
	private currentMemory = 0;
	private isLargeCollection: boolean;

	/**
	 * @param maxSize Maximum number of URLs to cache
	 * @param maxMemory Maximum memory in bytes
	 */
	constructor(maxSize = 5000, maxMemory = 200 * 1024 * 1024) {
		// Reduced memory for data URLs
		this.maxSize = maxSize;
		this.maxMemory = maxMemory;
		this.isLargeCollection = false;
	}

	/**
	 * Set collection size to determine caching strategy
	 */
	setCollectionSize(size: number): void {
		this.isLargeCollection = size > 1000;
		if (this.isLargeCollection) {
			// Switch to more aggressive eviction for large collections
			this.maxSize = Math.min(2000, size);
			this.maxMemory = 100 * 1024 * 1024; // 100MB for data URLs
		}
	}

	/**
	 * Get URL for the given image data
	 * Uses data URLs for large collections to prevent blob URL issues
	 */
	get(id: string, imageData: ArrayBuffer): string {
		const now = Date.now();
		const entry = this.cache.get(id);

		// Return cached URL if it exists and is fresh (within 5 seconds for data URLs, 10 seconds for blobs)
		if (entry) {
			const maxAge = this.isLargeCollection ? 5000 : 10000;
			if (now - entry.lastAccessed < maxAge) {
				entry.lastAccessed = now;
				return entry.url;
			}
		}

		// Aggressive eviction for large collections
		const evictionThreshold = this.isLargeCollection ? 0.7 : 0.8;
		if (
			this.cache.size >= this.maxSize * evictionThreshold ||
			this.currentMemory >= this.maxMemory * evictionThreshold
		) {
			this.evict();
		}

		let url: string;
		let size: number;

		// Use data URLs for large collections to eliminate blob URL issues
		if (this.isLargeCollection) {
			// Convert ArrayBuffer to base64 data URL
			const base64 = this.arrayBufferToBase64(imageData);
			const mimeType = this.guessMimeType(imageData);
			url = `data:${mimeType};base64,${base64}`;
			size = url.length; // Data URLs are stored as strings
		} else {
			// Use blob URLs for smaller collections
			const blob = new Blob([imageData]);
			url = URL.createObjectURL(blob);
			size = imageData.byteLength;
		}

		// Cache the URL
		this.cache.set(id, {
			url,
			type: this.isLargeCollection ? 'dataurl' : 'blob',
			size,
			lastAccessed: now
		});

		// Update memory usage
		if (entry) {
			this.currentMemory += size - entry.size;
		} else {
			this.currentMemory += size;
		}

		return url;
	}

	/**
	 * Convert ArrayBuffer to base64 string
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Guess MIME type from image data
	 */
	private guessMimeType(buffer: ArrayBuffer): string {
		const view = new Uint8Array(buffer);

		// PNG signature
		if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
			return 'image/png';
		}

		// JPEG signature
		if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
			return 'image/jpeg';
		}

		// GIF signature
		if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x38) {
			return 'image/gif';
		}

		// WebP signature
		if (view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) {
			return 'image/webp';
		}

		// Default to PNG
		return 'image/png';
	}

	/**
	 * Handle URL errors (data URLs don't fail, so this is mainly for blob URLs)
	 */
	handleUrlError(id: string): string | null {
		const entry = this.cache.get(id);
		if (entry && entry.type === 'blob') {
			try {
				// Revoke the old URL
				URL.revokeObjectURL(entry.url);

				// Create a fresh blob URL
				const blob = new Blob([new ArrayBuffer(0)]); // Placeholder, will be replaced
				const newUrl = URL.createObjectURL(blob);
				URL.revokeObjectURL(newUrl); // Revoke placeholder immediately

				// Remove old entry to force recreation
				this.cache.delete(id);
				return null;
			} catch (error) {
				console.warn('Failed to handle URL error for', id, error);
				return null;
			}
		}
		return null;
	}

	/**
	 * Preload an image into the cache with appropriate URL strategy
	 */
	preload(id: string, imageData: ArrayBuffer): string {
		// If already cached and not revoked, just update access time
		const existingEntry = this.cache.get(id);
		if (existingEntry && !existingEntry.revoked) {
			existingEntry.lastAccessed = Date.now();
			return existingEntry.url;
		}

		// For very large collections, use more aggressive eviction
		const evictionThreshold = this.maxSize > 3000 ? 0.6 : 0.9;

		// Check if we need to evict - use threshold here too
		if (
			this.cache.size >= this.maxSize * evictionThreshold ||
			this.currentMemory >= this.maxMemory * evictionThreshold
		) {
			// Evict multiple items if needed to make room
			const neededMemory = imageData.byteLength;
			const neededEntries = 1;
			let evicted = 0;

			// Keep evicting until we have enough space
			while (
				(this.cache.size >= this.maxSize - neededEntries && evicted < 10) ||
				(this.currentMemory + neededMemory >= this.maxMemory && evicted < 10)
			) {
				this.evict();
				evicted++;
			}
		}

		let url: string;
		let size: number;

		// Use data URLs for large collections to eliminate blob URL issues
		if (this.isLargeCollection) {
			// Convert ArrayBuffer to base64 data URL
			const base64 = this.arrayBufferToBase64(imageData);
			const mimeType = this.guessMimeType(imageData);
			url = `data:${mimeType};base64,${base64}`;
			size = url.length; // Data URLs are stored as strings
		} else {
			// Use blob URLs for smaller collections
			const blob = new Blob([imageData]);
			url = URL.createObjectURL(blob);
			size = imageData.byteLength;
		}

		this.cache.set(id, {
			url,
			type: this.isLargeCollection ? 'dataurl' : 'blob',
			size,
			lastAccessed: Date.now(),
			revoked: false
		});
		this.currentMemory += size;
		this.retryAttempts.delete(id);

		return url;
	}

	/**
	 * Check if an image is cached without creating ObjectURL
	 */
	has(id: string): boolean {
		return this.cache.has(id);
	}

	/**
	 * Get cached URL without accessing image data
	 */
	getCachedUrl(id: string): string | undefined {
		const entry = this.cache.get(id);
		return entry?.url;
	}

	/**
	 * Remove an entry from cache
	 */
	remove(id: string): void {
		const entry = this.cache.get(id);
		if (entry) {
			// Only revoke blob URLs, not data URLs
			if (entry.type === 'blob') {
				URL.revokeObjectURL(entry.url);
			}
			this.currentMemory -= entry.size;
			this.cache.delete(id);
			this.retryAttempts.delete(id);
		}
	}

	/**
	 * Mark an entry as revoked (keeps blob for potential recreation)
	 */
	markRevoked(id: string): void {
		const entry = this.cache.get(id);
		if (entry && !entry.revoked) {
			entry.revoked = true;
			// Don't revoke the URL immediately - let the cleanup handle it
		}
	}

	/**
	 * Clear all cached URLs
	 */
	clear(): void {
		this.cache.forEach((entry) => {
			// Only revoke blob URLs, not data URLs
			if (entry.type === 'blob') {
				URL.revokeObjectURL(entry.url);
			}
		});
		this.cache.clear();
		this.retryAttempts.clear();
		this.currentMemory = 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { size: number; memory: number; maxSize: number; maxMemory: number } {
		return {
			size: this.cache.size,
			memory: this.currentMemory,
			maxSize: this.maxSize,
			maxMemory: this.maxMemory
		};
	}

	/**
	 * Evict least recently used entries (more aggressive for large collections)
	 */
	private evict(): void {
		// Sort entries by last accessed time
		const entries = Array.from(this.cache.entries()).sort(
			([, a], [, b]) => a.lastAccessed - b.lastAccessed
		);

		// Remove more entries for large collections (25% of cache or at least 10)
		const toRemove = Math.max(10, Math.floor(this.cache.size * 0.25));

		for (let i = 0; i < toRemove && i < entries.length; i++) {
			const [key] = entries[i];
			this.remove(key);
		}
	}

	/**
	 * Check if a URL is likely revoked by testing it
	 */
	isUrlRevoked(url: string): boolean {
		try {
			// Create a test image to see if the URL is still valid
			const img = new Image();
			img.src = url;
			return img.naturalWidth === 0 && img.naturalHeight === 0;
		} catch {
			return true;
		}
	}
}

// Singleton instance for gallery use
// Optimized for 10K+ NFT collections with increased limits
export const imageUrlCache = new ObjectUrlCache(); // 5000 images or 500MB (uses defaults)
