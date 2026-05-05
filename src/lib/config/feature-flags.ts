/**
 * Runtime feature flag system for phased rollout of optimizations.
 * All Phase 2/3/4 flags default to false. Phase 1 changes ship unconditionally.
 * Flags can be toggled via environment variables (VITE_ENABLE_*).
 */

export interface FeatureFlags {
	/** Phase 2: Stream generated images/metadata to IndexedDB instead of accumulating in memory */
	enableStreamingStorage: boolean;
	/** Phase 2: Transfer layers once by reference (ID-based batching) instead of full layers per batch */
	enableLayerRef: boolean;
	/** Phase 3: Offload CSP solver to a dedicated Web Worker */
	enableWorkerCspSolver: boolean;
	/** Phase 3: Use adaptive batch sizing based on collection size, worker count, and resolution */
	enableAdaptiveBatchSize: boolean;
	/** Phase 4: Use SharedArrayBuffer-based shared cache across workers (requires COOP/COEP) */
	enableSharedWorkerCache: boolean;
	/** Phase 4: Persist gallery image data in IndexedDB so images survive refresh */
	enableGalleryImagePersistence: boolean;
	/** Phase 4: Offload ZIP packaging to a dedicated Web Worker */
	enableZipWorkerOffloading: boolean;
}

function readEnvFlag(name: string): boolean {
	try {
		const value = import.meta.env?.[name];
		return value === 'true' || value === true;
	} catch {
		return false;
	}
}

const defaultFlags: FeatureFlags = {
	enableStreamingStorage: readEnvFlag('VITE_ENABLE_STREAMING_STORAGE'),
	enableLayerRef: readEnvFlag('VITE_ENABLE_LAYER_REF'),
	enableWorkerCspSolver: readEnvFlag('VITE_ENABLE_WORKER_CSP_SOLVER'),
	enableAdaptiveBatchSize: readEnvFlag('VITE_ENABLE_ADAPTIVE_BATCH_SIZE'),
	enableSharedWorkerCache: readEnvFlag('VITE_ENABLE_SHARED_WORKER_CACHE'),
	enableGalleryImagePersistence: readEnvFlag('VITE_ENABLE_GALLERY_IMAGE_PERSISTENCE'),
	enableZipWorkerOffloading: readEnvFlag('VITE_ENABLE_ZIP_WORKER_OFFLOADING')
};

let runtimeOverrides: Partial<FeatureFlags> = {};

/**
 * Check if a feature flag is enabled.
 */
export function isFlagEnabled(flag: keyof FeatureFlags): boolean {
	return runtimeOverrides[flag] ?? defaultFlags[flag];
}

/**
 * Override feature flags at runtime (useful for dev-only UI panels or testing).
 */
export function setFeatureFlags(overrides: Partial<FeatureFlags>): void {
	runtimeOverrides = { ...runtimeOverrides, ...overrides };
}

/**
 * Get all current feature flag values (including runtime overrides).
 */
export function getFeatureFlags(): FeatureFlags {
	return { ...defaultFlags, ...runtimeOverrides };
}

/**
 * Reset runtime overrides to defaults.
 */
export function resetFeatureFlags(): void {
	runtimeOverrides = {};
}
