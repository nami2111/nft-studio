# Performance Architecture

GNStudio employs a multi-layered performance architecture designed for large-scale collection generation (up to 10,000 items per run).

## Three-Tier Caching System

### ImageBitmap Cache (GPU-Accelerated)

```
Max Size: 100MB | Max Entries: 500 | TTL: 30 minutes
Purpose: GPU-accelerated image rendering
Best for: Canvas composition in generation workers
```

- 64-entry LRU cache in the generation worker for decoded images
- Bounds GPU memory usage by evicting least recently used entries
- Device pixel ratio support for sharp rendering

### ImageData Cache (CPU)

```
Max Size: 50MB | Max Entries: 200 | TTL: 15 minutes
Purpose: Pixel-level manipulation
Best for: Image analysis and transformation
```

- Canvas manipulation operations
- Pixel-level access for advanced effects
- Faster than ImageBitmap for manipulation tasks

### ArrayBuffer Cache (Transferable)

```
Max Size: 200MB | Max Entries: 1000 | TTL: 1 hour
Purpose: Worker communication
Best for: Trait image data shared across workers
```

- WorkerArrayBufferCache with device-aware sizing
- 25 entries per GB of device memory, max 200 entries
- 15% of device memory allocated, capped at 100MB
- Transferable ArrayBuffer objects for zero-copy worker communication
- LRU eviction with frequency scoring and single-pass top-k selection (O(n))

## Memory Pressure Management

The system monitors memory usage and triggers cleanup at three thresholds:

| Pressure Level | Threshold | Action                                       |
| -------------- | --------- | -------------------------------------------- |
| Light          | 200MB+    | Periodic cleanup every 5 minutes             |
| Moderate       | 500MB+    | More aggressive eviction, reduce batch sizes |
| High           | 800MB+    | Aggressive cache eviction, GC trigger        |

### Automatic Cleanup

- ObjectURL revocation on project reset/cleanup
- Expired cache entries evicted on access
- Worker resources terminated on task completion
- Event listeners and timers cleaned up

## Worker Pool Architecture

### Dynamic Scaling

Worker count is determined by device capabilities:

- **CPU Cores**: `navigator.hardwareConcurrency` with 75% utilization target
- **Memory**: `navigator.deviceMemory` with 128MB per worker estimate
- **Mobile Detection**: 50% worker reduction on mobile devices
- **Max Workers**: 8 (hard limit)

### Task Classification

Tasks are classified by complexity for optimal routing:

| Complexity | Collection Size | Layers | Resolution          |
| ---------- | --------------- | ------ | ------------------- |
| LOW        | ≤ 100           | ≤ 3    | ≤ 500×500           |
| MEDIUM     | 101-1000        | 4-10   | 500×500-1000×1000   |
| HIGH       | 1001-5000       | 11-20  | 1000×1000-1500×1500 |
| VERY_HIGH  | 5000+           | 20+    | 1500×1500+          |

### Health Monitoring

- Ping-based health checks every 30 seconds
- Workers marked as `HEALTHY`, `DEGRADED`, or `UNRESPONSIVE`
- Automatic restart for failed workers (up to 3 attempts)
- Work-stealing from overloaded workers to idle ones
- 30-second timeout monitoring for stuck tasks

### Scheduling

- **Work Stealing**: New tasks assigned to the least-loaded worker (based on task count and average task time)
- **Adaptive Batch Size**: Batch sizes adjusted based on collection size, worker count, and resolution
- **Timeout Recovery**: Stuck tasks are detected and reassigned after 30 seconds

## CSP Solver Performance

### AC-3 Arc Consistency

- Prunes incompatible trait domains before backtracking
- 60-80% search space reduction
- Runs once per generation, not per item

### MRV Heuristic

- Most Constrained Variable heuristic selects layers with fewest remaining options first
- Reduces backtracking depth by 40-60%

### Efraimidis-Spirakis Algorithm

- Weighted-random trait selection that respects rarity weights
- O(n log k) complexity for selecting k weighted items from n candidates
- Deterministic results when given the same seed

### Trail-Based Backtracking

- Domain restoration using trail logs instead of full copy
- Forward-checking only neighbor layers instead of full AC-3 re-run
- Impossible combination caching avoids retrying known dead ends

## Generation Pipeline

```
Trait Configuration
       │
       ▼
Project Validation ──► CSP Solving (AC-3 + MRV + Weighted Random)
       │                       │
       │                       ▼
       │              Trait Solution Array
       │                       │
       │                       ▼
       │              Batch Scheduler
       │                       │
       │                       ▼
       └────── Layer Data ──► Worker Pool
                               │
                     ┌─────────┼─────────┐
                     ▼         ▼         ▼
                  Worker 1  Worker 2  Worker N
                     │         │         │
                     └─────────┼─────────┘
                               │
                     ┌─────────┼─────────┐
                     ▼         ▼         ▼
                Images (PNG)    Metadata (JSON)
                     │              │
                     └──────┬───────┘
                            ▼
                    ZIP Export / IndexedDB Stream
```

### Streaming Storage Mode

When `enableStreamingStorage` is enabled:

1. Each completed item is immediately written to IndexedDB
2. ZIP creation reads from IndexedDB instead of memory
3. Peak memory usage reduced by 60-80% for large collections

## ZIP Export Pipeline

| Collection Size | Strategy        | Details                                                                    |
| --------------- | --------------- | -------------------------------------------------------------------------- |
| ≤ 1000 items    | Standard ZIP    | JSZip in main thread                                                       |
| 1001-3000 items | Optimized ZIP   | Chunked processing, 100 items per chunk                                    |
| 3001+ items     | Multi-ZIP       | Split into multiple 1GB ZIP files                                          |
| ≥ 500 items     | Worker Offload  | Dedicated one-shot ZIP Web Worker (if `enableZipWorkerOffloading` enabled) |
| During gen      | Streaming ZIP   | Persistent worker accumulates chunks, flushes at 700MB raw                 |
| IndexedDB mode  | Batch packaging | 500MB-bounded ZIP batches read from IndexedDB post-gen                     |

### ZIP Worker Volume Management

The streaming ZIP worker (`zip.worker.ts`) maintains a pending file buffer and uses volume-based flushing:

- **Threshold**: 700MB raw pending size triggers a flush
- **Truncation**: If pending exceeds threshold, flushes only up to the limit (remaining files stay pending)
- **Final flush**: `isFinal` signal flushes all remaining files regardless of size
- **Drain loop**: After each flush, checks if more data accumulated during async ZIP generation and flushes again if needed

### Download Queue

Multi-ZIP exports use a sequential download queue to prevent browser download manager overload:

- Downloads are processed one at a time with 5-second delays between triggers
- Required for large blob URLs (700MB+) that need time to begin streaming
- Prevents race conditions where `revokeObjectURL` interrupts an in-progress download

### Blob URL Lifecycle

- All blob URLs created during export are tracked in a `Set<string>`
- URLs are **not** revoked immediately after `a.click()` — the browser may still be streaming
- All tracked URLs are revoked on `beforeunload` event to prevent memory leaks

## Performance Monitoring

The `PerformanceMonitor` tracks:

- **Operation Timing**: Timer-based tracking with automatic metric collection
- **Cache Metrics**: Hit/miss/eviction tracking with hit rate computation
- **Database Queries**: Query timing with slow-query detection
- **Memory Usage**: Heap snapshot history with configurable time windows
- **Batch Progress**: ETA estimation based on items/second throughput
- **Alerts**: Threshold-based alerts with severity levels

### Key Metrics

```
Items per second (throughput)
Cache hit rate (per cache tier)
Worker utilization (per worker)
Memory usage (heap + cache)
Batch completion time (per batch)
Average task time (per worker)
```

## Browser Performance

| Browser     | Web Workers  | Canvas          | Notes                      |
| ----------- | ------------ | --------------- | -------------------------- |
| Chrome/Edge | Full support | GPU-accelerated | Best performance           |
| Firefox     | Full support | Optimized       | Good for large collections |
| Safari      | Full support | Compatible      | Standard performance       |

## Development Monitoring

Dev-only components available in the UI:

- `PerformanceMonitor.svelte` - Real-time performance dashboard
- `CacheMonitor.svelte` - Cache hit rates and memory usage per tier
- Worker pool status indicators in the generation progress panel
