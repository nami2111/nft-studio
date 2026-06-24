/**
 * Runtime feature flag system for phased rollout of optimizations.
 * Flags can be toggled via environment variables (VITE_ENABLE_*).
 * Existing VITE_DISABLE_* flags are still honored for backward compatibility.
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

function readEnvValue(name: string): unknown {
	try {
		return import.meta.env?.[name];
	} catch {
		return undefined;
	}
}

function parseEnvBoolean(value: unknown): boolean | undefined {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	return undefined;
}

function readEnvFlag(name: string, defaultValue: boolean): boolean {
	return parseEnvBoolean(readEnvValue(name)) ?? defaultValue;
}

function readDefaultOnFlag(enableName: string, disableName: string): boolean {
	const enabled = parseEnvBoolean(readEnvValue(enableName));
	if (enabled !== undefined) return enabled;
	const disabled = parseEnvBoolean(readEnvValue(disableName));
	if (disabled !== undefined) return !disabled;
	return true;
}

const defaultFlags: FeatureFlags = {
	enableStreamingStorage: readDefaultOnFlag(
		'VITE_ENABLE_STREAMING_STORAGE',
		'VITE_DISABLE_STREAMING_STORAGE'
	),
	enableOpfsStorage: readEnvFlag('VITE_ENABLE_OPFS_STORAGE', true),
	enableLayerRef: readEnvFlag('VITE_ENABLE_LAYER_REF', false),
	enableAdaptiveBatchSize: readDefaultOnFlag(
		'VITE_ENABLE_ADAPTIVE_BATCH_SIZE',
		'VITE_DISABLE_ADAPTIVE_BATCH_SIZE'
	),
	enableZipWorkerOffloading: readEnvFlag('VITE_ENABLE_ZIP_WORKER_OFFLOADING', false)
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
