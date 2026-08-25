# Feature Flags

GNStudio uses a feature flag system for runtime-tunable behavior. Flags can be
toggled via environment variables or overridden at runtime. Browser storage is
private to the current browser profile and quota-managed by the browser.

## Available Flags

| Flag                     | Default | Env Override                                     | Purpose                                                                                                                 |
| ------------------------ | ------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `enableStreamingStorage` | Enabled | `VITE_DISABLE_STREAMING_STORAGE=true` to disable | Streams generated images and metadata to browser storage during generation instead of accumulating everything in memory |

This is the only remaining flag. Former flags (`enableOpfsStorage`,
`enableLayerRef`, `enableAdaptiveBatchSize`, `enableZipWorkerOffloading`) were
each read at exactly one call site with a fixed default and have been inlined
as constants:

- **OPFS storage**: always used when the browser supports it; IndexedDB object
  backend otherwise (see `src/lib/storage/backend.ts`)
- **Layer-reference batching**: always enabled in the trait-batch-scheduler
- **Adaptive batch size / ZIP worker offloading**: behavior folded into the
  generation orchestrator and ZIP worker

## Flag Details

### enableStreamingStorage

When enabled, the generation pipeline streams each completed item to browser storage as it finishes, rather than holding all generated items in memory. This significantly reduces peak memory usage during large generations.

**When to enable**: Always (default). Only disable for debugging or if browser storage is unavailable.

**Performance impact**: Reduces peak memory usage by 60-80% for collections over 1000 items.

## Environment Variable Convention

- Enabling a feature: `VITE_ENABLE_<FLAG_NAME>=true`
- Disabling a feature: `VITE_DISABLE_<FLAG_NAME>=true`

Environment variables are set in `.env` files or during build:

```bash
# Disable streaming storage
VITE_DISABLE_STREAMING_STORAGE=true vp run build
```

## Runtime Overrides

Feature flags can be overridden at runtime via the API:

```typescript
import { setFeatureFlags, getFeatureFlags, resetFeatureFlags } from '$lib/config/feature-flags';

// Override specific flags
setFeatureFlags({ enableStreamingStorage: false });

// Get current values
const flags = getFeatureFlags();

// Reset to defaults
resetFeatureFlags();
```

## Default Configuration

```typescript
// Production defaults (as defined in src/lib/config/feature-flags.ts)
{
	enableStreamingStorage: true;
}
```
