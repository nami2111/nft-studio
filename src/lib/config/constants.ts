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
	MEMORY_PRESSURE_AGGRESSIVE: 100 * 1024 * 1024, // 100MB
	MEMORY_PRESSURE_MODERATE: 50 * 1024 * 1024, // 50MB
	MEMORY_PRESSURE_LIGHT: 20 * 1024 * 1024, // 20MB

	// Generation worker limits
	WORKER_CACHE_ALLOCATION_MAX: 100 * 1024 * 1024, // 100MB
	WORKER_MAX_MEMORY_BYTES: 200 * 1024 * 1024, // 200MB cap
	WORKER_MEMORY_FRACTION: 0.1, // 10% of available memory

	// Performance monitoring
	PERFORMANCE_MEMORY_THRESHOLD: 100 * 1024 * 1024, // 100MB
	PERFORMANCE_HEAP_LIMIT_DEFAULT: 4 * 1024 * 1024 * 1024, // 4GB default
	PERFORMANCE_PEAK_MEMORY_LIMIT: 500 * 1024 * 1024 // 500MB
};

// File Size Limits (in bytes)
export const FILE_SIZE = {
	MIN: 1, // 1 byte minimum
	MAX_IMAGE: 10 * 1024 * 1024, // 10MB max for images
	MAX_PROJECT: 200 * 1024 * 1024, // 200MB max for projects
	MAX_ZIP: 1 * 1024 * 1024 * 1024, // 1GB max for ZIP exports
	MAX_LAYER_UPLOAD: 100 * 1024 * 1024, // 100MB limit for layer uploads

	// Storage limits
	LOCAL_STORAGE_QUOTA: 5 * 1024 * 1024, // 5MB limit for localStorage
	LARGE_PROJECT_THRESHOLD: 2 * 1024 * 1024 // 2MB threshold for large projects
};

// Time Constants (in milliseconds)
export const TIME = {
	// Cache TTLs
	BITMAP_CACHE_TTL: 30 * 60 * 1000, // 30 minutes
	DATA_CACHE_TTL: 15 * 60 * 1000, // 15 minutes
	BUFFER_CACHE_TTL: 60 * 60 * 1000, // 1 hour

	// Debounce intervals
	SAVE_DEBOUNCE: 1000, // 1 second for general saves
	GALLERY_SAVE_DEBOUNCE: 1000, // 1 second for gallery saves

	// Cleanup intervals
	MEMORY_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
	METRICS_COLLECTION_INTERVAL: 30 * 1000, // 30 seconds

	// UI delays
	BATCH_DELAY: 25, // 25ms delay between batches for UI responsiveness
	PROGRESS_RESET_DELAY: 100 // 100ms delay to reset progress indicator
};

// Batch Processing
export const BATCH = {
	DEFAULT_SIZE: 5, // Default batch size for file processing
	IMAGE_PROCESSING_SIZE: 5 // Batch size for image uploads
};

// Cache Configuration
export const CACHE = {
	GALLERY_FILTER_MAX_ENTRIES: 100, // Max entries in gallery filter cache

	// LRU eviction settings
	LRU_EVICTION_ENABLED: true,

	// Sprite packing
	SPRITE_ATLAS_SIZE_BYTES: 3 * 1024 * 1024 // ~3MB per atlas
};

// Validation Limits
export const VALIDATION = {
	MAX_NAME_LENGTH: 100, // Max characters for names (layers, traits, projects)
	MAX_FILENAME_LENGTH: 100, // Max characters for filenames

	// Trait rarity
	DEFAULT_RARITY_WEIGHT: 5, // Default rarity weight for traits
	MIN_RARITY_WEIGHT: 1,
	MAX_RARITY_WEIGHT: 10
};

// UI Configuration
export const UI = {
	// Modal defaults
	MODAL_DEFAULT_MAX_WIDTH: '500px',
	MODAL_LARGE_MAX_WIDTH: '700px',
	MODAL_SMALL_MAX_WIDTH: '350px',

	// Toast durations (in milliseconds)
	TOAST_SUCCESS_DURATION: 4000,
	TOAST_ERROR_DURATION: 6000,
	TOAST_WARNING_DURATION: 5000,
	TOAST_INFO_DURATION: 4000
};

// Worker Configuration
export const WORKER = {
	// Maximum workers based on device capabilities
	MAX_WORKERS: 8,
	MIN_WORKERS: 1,

	// Health check interval
	HEALTH_CHECK_INTERVAL: 30000, // 30 seconds

	// Queue thresholds for scaling
	SCALE_UP_THRESHOLD: 10,
	SCALE_DOWN_THRESHOLD: 3,
	SCALE_COOLDOWN: 60000 // 1 minute between scaling operations
};
