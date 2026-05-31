/**
 * Runtime feature flag system for phased rollout of optimizations.
 * All Phase 2/3/4 flags default to false. Phase 1 changes ship unconditionally.
 * Flags can be toggled via environment variables (VITE_ENABLE_*).
 */

export interface FeatureFlags {
	/** Stream generated images/metadata to browser storage instead of accumulating in memory */
	enableStreamingStorage: boolean;
	/** Use OPFS as the primary browser storage backend for large binary payloads */
	enableOpfsStorage: boolean;
	/** Transfer layers once by reference (ID-based batching) instead of full layers per batch */
	enableLayerRef: boolean;
	/** Use adaptive batch sizing based on collection size, worker count, and resolution */
	enableAdaptiveBatchSize: boolean;
	/** Offload ZIP packaging to a dedicated Web Worker */
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
	enableStreamingStorage: import.meta.env?.VITE_DISABLE_STREAMING_STORAGE !== 'true',
	enableOpfsStorage: import.meta.env?.VITE_ENABLE_OPFS_STORAGE !== 'false',

	enableLayerRef: readEnvFlag('VITE_ENABLE_LAYER_REF'),
	enableAdaptiveBatchSize: import.meta.env?.VITE_DISABLE_ADAPTIVE_BATCH_SIZE !== 'true',
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
