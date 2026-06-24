/**
 * Application Constants
 * Centralized constants for memory limits, timeouts, sizes, and other configuration values
 */

// Memory Size Constants (in bytes)
export const MEMORY = {
	KB: 1024,
	MB: 1024 * 1024,
	GB: 1024 * 1024 * 1024,

	// Cache limits
	IMAGE_BITMAP_CACHE_MAX_SIZE: 100 * 1024 * 1024, // 100MB
	IMAGE_BITMAP_CACHE_MAX_ENTRIES: 500,
	IMAGE_BITMAP_CACHE_TTL: 30 * 60 * 1000, // 30 minutes

	IMAGE_DATA_CACHE_MAX_SIZE: 50 * 1024 * 1024, // 50MB
	IMAGE_DATA_CACHE_MAX_ENTRIES: 200,
	IMAGE_DATA_CACHE_TTL: 15 * 60 * 1000, // 15 minutes

	ARRAY_BUFFER_CACHE_MAX_SIZE: 200 * 1024 * 1024, // 200MB
	ARRAY_BUFFER_CACHE_MAX_ENTRIES: 1000,
	ARRAY_BUFFER_CACHE_TTL: 60 * 60 * 1000, // 1 hour

	// Object URL cache
	OBJECT_URL_CACHE_MAX_MEMORY: 100 * 1024 * 1024, // 100MB for data URLs

	// Memory pressure thresholds
	MEMORY_PRESSURE_AGGRESSIVE: 800 * 1024 * 1024, // 800MB
	MEMORY_PRESSURE_MODERATE: 500 * 1024 * 1024, // 500MB
	MEMORY_PRESSURE_LIGHT: 200 * 1024 * 1024, // 200MB

	// Generation worker limits
	WORKER_CACHE_ALLOCATION_MAX: 100 * 1024 * 1024, // 100MB
	WORKER_MAX_MEMORY_BYTES: 200 * 1024 * 1024, // 200MB cap
	WORKER_MEMORY_FRACTION: 0.1, // 10% of available memory

	// Performance monitoring
	PERFORMANCE_MEMORY_THRESHOLD: 100 * 1024 * 1024, // 100MB
	PERFORMANCE_HEAP_LIMIT_DEFAULT: 4 * 1024 * 1024 * 1024, // 4GB default
	PERFORMANCE_PEAK_MEMORY_LIMIT: 500 * 1024 * 1024 // 500MB
};

// Time Constants (in milliseconds)
export const TIME = {
	// Cache TTLs
	BITMAP_CACHE_TTL: 30 * 60 * 1000, // 30 minutes
	DATA_CACHE_TTL: 15 * 60 * 1000, // 15 minutes
	BUFFER_CACHE_TTL: 60 * 60 * 1000, // 1 hour

	// Debounce intervals
	SAVE_DEBOUNCE: 1000, // 1 second for general saves

	// Cleanup intervals
	MEMORY_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
	METRICS_COLLECTION_INTERVAL: 30 * 1000, // 30 seconds

	// UI delays
	BATCH_DELAY: 25, // 25ms delay between batches for UI responsiveness
	PROGRESS_RESET_DELAY: 100 // 100ms delay to reset progress indicator
};
