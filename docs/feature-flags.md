# Feature Flags

GNStudio uses a feature flag system for phased rollout of performance optimizations. Flags can be toggled via environment variables or overridden at runtime.

## Available Flags

| Flag | Default | Env Override | Purpose |
|------|---------|--------------|---------|
| `enableStreamingStorage` | Enabled | `VITE_DISABLE_STREAMING_STORAGE=true` to disable | Streams generated images and metadata to IndexedDB during generation instead of accumulating everything in memory |
| `enableLayerRef` | Disabled | `VITE_ENABLE_LAYER_REF=true` to enable | Transfers layer data to workers once by ID reference, reducing per-batch data transfer size |
| `enableAdaptiveBatchSize` | Enabled | `VITE_DISABLE_ADAPTIVE_BATCH_SIZE=true` to disable | Dynamically adjusts batch size based on collection size, worker count, and output resolution |
| `enableZipWorkerOffloading` | Disabled | `VITE_ENABLE_ZIP_WORKER_OFFLOADING=true` to enable | Offloads ZIP file packaging to a dedicated Web Worker for large collections |

## Flag Details

### enableStreamingStorage

When enabled, the generation pipeline streams each completed item to IndexedDB as it finishes, rather than holding all generated items in memory. This significantly reduces peak memory usage during large generations.

**When to enable**: Always (default). Only disable for debugging or if IndexedDB is unavailable.

**Performance impact**: Reduces peak memory usage by 60-80% for collections over 1000 items.

### enableLayerRef

When enabled, the layer initialization message sends all layer data once to each worker, then subsequent batch messages reference layers by ID only. This reduces per-batch message size.

**When to enable**: For collections with many layers (> 5) and large numbers of small batches.

**Performance impact**: Reduces worker message size by 30-50% for multi-layer collections.

### enableAdaptiveBatchSize

When enabled, the system calculates optimal batch sizes based on:
- Collection size (smaller batches for larger collections to spread work evenly)
- Available worker count (more workers = smaller per-worker batches)
- Output resolution (higher resolution = smaller batches to prevent memory pressure)

**When to enable**: Always (default) for balanced worker utilization.

**Performance impact**: Improves worker utilization and reduces straggler tasks.

### enableZipWorkerOffloading

When enabled, ZIP file creation runs in a dedicated Web Worker, preventing UI blocking during large ZIP exports. The main thread delegates packaging to the worker and receives progress updates.

**When to enable**: For collections over 500 items where ZIP creation may block the UI.

**Performance impact**: Eliminates UI freezes during ZIP export for collections up to 10,000 items.

## Environment Variable Convention

- Enabling a feature: `VITE_ENABLE_<FLAG_NAME>=true`
- Disabling a feature: `VITE_DISABLE_<FLAG_NAME>=true`

Environment variables are set in `.env` files or during build:

```bash
# Enable layer reference mode
VITE_ENABLE_LAYER_REF=true vp run build

# Disable streaming storage
VITE_DISABLE_STREAMING_STORAGE=true vp run build
```

## Runtime Overrides

Feature flags can be overridden at runtime via the API:

```typescript
import { setFeatureFlags, getFeatureFlags, resetFeatureFlags } from '$lib/config/feature-flags';

// Override specific flags
setFeatureFlags({ enableLayerRef: true });

// Get current values
const flags = getFeatureFlags();

// Reset to defaults
resetFeatureFlags();
```

## Default Configuration

```typescript
// Production defaults (as defined in src/lib/config/feature-flags.ts)
{
	enableStreamingStorage: true,
	enableLayerRef: false,
	enableAdaptiveBatchSize: true,
	enableZipWorkerOffloading: false
}
```

The defaults are designed for the safest, most compatible experience. Advanced flags are disabled by default and should be enabled after testing in your environment.
