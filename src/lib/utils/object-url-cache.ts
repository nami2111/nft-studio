/**
 * Cache for managing image blob URLs.
 * Uses Object URLs with TTL eviction for all collection sizes.
 * Blob URL data lives in browser-managed storage, not JS heap.
 */

export class ObjectUrlCache {
	private cache = new Map<
		string,
		{ url: string; type: 'blob'; size: number; lastAccessed: number; revoked?: boolean }
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
		this.maxSize = maxSize;
		this.maxMemory = maxMemory;
		this.isLargeCollection = false;

		// Set up periodic cleanup of revoked entries (every 30 seconds)
		if (typeof window !== 'undefined') {
			setInterval(() => {
				this.cleanupRevokedEntries();
			}, 30 * 1000);
		}
	}

	/**
	 * Set collection size to determine caching strategy
	 */
	setCollectionSize(size: number): void {
		this.isLargeCollection = size > 1000;
		if (this.isLargeCollection) {
			// More aggressive eviction for large collections
			this.maxSize = Math.min(2000, size);
			this.maxMemory = 100 * 1024 * 1024;
		}
	}

	/**
	 * Get URL for the given image data. Always uses Object URLs.
	 * Handles both ArrayBuffer and string (blob URL) inputs.
	 */
	get(id: string, imageData: ArrayBuffer | string): string {
		const now = Date.now();
		const entry = this.cache.get(id);

		// If entry exists and is not marked as revoked, check TTL
		if (entry) {
			const maxAge = this.isLargeCollection ? 5000 : 30000;
			if (now - entry.lastAccessed < maxAge) {
				entry.lastAccessed = now;
				// If it was marked revoked, recreate the URL
				if (entry.revoked && entry.type === 'blob' && typeof imageData !== 'string') {
					this.recreateBlobUrl(id, imageData);
				}
				return entry.url;
			}
			// Entry is expired, remove it
			this.remove(id);
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

		// Reject empty ArrayBuffer to avoid creating broken blob URLs
		if (imageData instanceof ArrayBuffer && imageData.byteLength === 0) {
			return '';
		}

		// Handle string input (blob URL)
		if (typeof imageData === 'string') {
			// Already a blob URL, use it directly
			url = imageData;
			size = 0; // Blob URLs don't consume cache memory directly

			// Cache the URL as blob type for consistency
			this.cache.set(id, {
				url,
				type: 'blob',
				size,
				lastAccessed: now,
				revoked: false
			});

			return url;
		}

		const blob = new Blob([imageData]);
		url = URL.createObjectURL(blob);
		size = imageData.byteLength;

		// Cache the URL
		this.cache.set(id, {
			url,
			type: 'blob',
			size,
			lastAccessed: now,
			revoked: false
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
	 * Handle URL errors for blob URLs
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
	 * Handles both ArrayBuffer and string (blob URL) inputs
	 */
	preload(id: string, imageData: ArrayBuffer | string): string {
		// If already cached and not revoked, just update access time
		const existingEntry = this.cache.get(id);
		if (existingEntry && !existingEntry.revoked) {
			existingEntry.lastAccessed = Date.now();
			return existingEntry.url;
		}

		// If cached but revoked, recreate the blob URL
		if (existingEntry && existingEntry.revoked && typeof imageData !== 'string') {
			this.recreateBlobUrl(id, imageData);
			return this.cache.get(id)!.url;
		}

		// For very large collections, use more aggressive eviction
		const evictionThreshold = this.maxSize > 3000 ? 0.6 : 0.9;

		// Check if we need to evict - use threshold here too
		if (
			this.cache.size >= this.maxSize * evictionThreshold ||
			this.currentMemory >= this.maxMemory * evictionThreshold
		) {
			// Evict multiple items if needed to make room
			const neededMemory = typeof imageData !== 'string' ? imageData.byteLength : 1024;
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

		// Handle string (blob URL) input directly
		if (typeof imageData === 'string') {
			url = imageData;
			size = 1024; // Estimate size for blob URLs
			this.cache.set(id, {
				url,
				type: 'blob',
				size,
				lastAccessed: Date.now(),
				revoked: false
			});
			this.currentMemory += size;
			return url;
		}

		// Always create a blob URL
		const blob = new Blob([imageData]);
		url = URL.createObjectURL(blob);
		size = imageData.byteLength;

		this.cache.set(id, {
			url,
			type: 'blob',
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
	 * Remove an entry from cache (lazy revocation for blob URLs)
	 */
	remove(id: string): void {
		const entry = this.cache.get(id);
		if (entry) {
			// Mark as revoked instead of immediately revoking (lazy cleanup)
			// This allows existing DOM references to continue working
			if (entry.type === 'blob' && !entry.revoked) {
				entry.revoked = true;
			} else {
				// Remove immediately to free memory
				this.currentMemory -= entry.size;
				this.cache.delete(id);
				this.retryAttempts.delete(id);
			}
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
		// Revoke all blob URLs immediately on full clear
		this.cache.forEach((entry) => {
			if (entry.type === 'blob' && !entry.revoked) {
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
	 * Uses lazy revocation to prevent ERR_FILE_NOT_FOUND errors
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

		// After marking entries as revoked, clean up the cache periodically
		// This happens after eviction to avoid cluttering the cache
		setTimeout(() => this.cleanupRevokedEntries(), 100);
	}

	/**
	 * Clean up entries that are marked as revoked
	 * Only removes them from the cache, doesn't revoke URLs (lazy approach)
	 */
	private cleanupRevokedEntries(): void {
		const toRemove: string[] = [];
		this.cache.forEach((entry, key) => {
			if (entry.revoked) {
				toRemove.push(key);
			}
		});

		toRemove.forEach((key) => {
			const entry = this.cache.get(key);
			if (entry) {
				this.currentMemory -= entry.size;
				this.cache.delete(key);
				this.retryAttempts.delete(key);
			}
		});
	}

	/**
	 * Recreate a blob URL for an entry that was marked as revoked
	 * Note: This only works with ArrayBuffer inputs, not string blob URLs
	 */
	private recreateBlobUrl(id: string, imageData: ArrayBuffer): void {
		const entry = this.cache.get(id);
		if (entry && entry.type === 'blob' && entry.revoked) {
			// Create a new blob URL
			const blob = new Blob([imageData]);
			const newUrl = URL.createObjectURL(blob);

			// Update the entry
			entry.url = newUrl;
			entry.revoked = false;
			entry.lastAccessed = Date.now();
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
// Optimized for 10K+ items with increased limits
export const imageUrlCache = new ObjectUrlCache(); // 5000 images or 500MB (uses defaults)
