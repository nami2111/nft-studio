/**
 * Re-export shim — productionMonitor is now an alias for the unified performanceMonitor.
 * All cache, database, memory, and alert metrics are available through performanceMonitor.
 */

import { performanceMonitor } from '$lib/utils/performance-monitor';

// Backward-compatible export
export const productionMonitor = performanceMonitor;

// Re-export types for backward compatibility
export type { CacheMetrics } from '$lib/utils/performance-monitor';
