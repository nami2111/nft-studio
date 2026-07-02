/**
 * Runtime feature flag system for streaming storage.
 *
 * Other flags (enableOpfsStorage, enableAdaptiveBatchSize, enableZipWorkerOffloading,
 * enableLayerRef) were each read at exactly one call site with a fixed default —
 * they've been inlined as constants. Only enableStreamingStorage remains because
 * it has genuine multi-site runtime toggling via setFeatureFlags (used in tests).
 */

export interface FeatureFlags {
	/** Stream generated images/metadata to browser storage instead of accumulating in memory */
	enableStreamingStorage: boolean;
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
	)
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
 * Reset runtime overrides to defaults.
 */
export function resetFeatureFlags(): void {
	runtimeOverrides = {};
}
