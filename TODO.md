# NFT Studio TODO

## 🚨 CRITICAL - Memory Leaks & Performance Issues

### High Priority - Generation Mode Memory Leaks

- **[CRITICAL]** Add `onDestroy` hook to GenerationForm.svelte for component cleanup
  - Location: `src/lib/components/GenerationForm.svelte`
  - Issue: Component doesn't cleanup when unmounted during active generation
  - Risk: Browser tab crashes with large collections (>1000 NFTs)
  - Fix: Add cleanup for ongoing generations, accumulated data, and event listeners

- **[HIGH]** Implement memory limits for large collections
  - Location: GenerationForm.svelte lines 29-30 (allImages, allMetadata)
  - Issue: Unlimited memory accumulation during generation
  - Risk: 2-5GB+ RAM usage with 5000+ NFT collections
  - Fix: Add 500MB memory limit with streaming fallback

- **[HIGH]** Fix worker pool background interval cleanup
  - Location: `src/lib/workers/worker.pool.ts:1031-1040`
  - Issue: Health check and scaling intervals continue after component unmount
  - Risk: Memory growth and performance degradation over time
  - Fix: Add proper cleanup function for background processes

### Medium Priority - Performance Optimizations

- **[MEDIUM]** Fix loading state subscription leaks
  - Location: `src/lib/stores/loading-state.svelte.ts:14-18`
  - Issue: Permanent subscription without cleanup mechanism
  - Risk: Unnecessary CPU usage after component destruction
  - Fix: Add unsubscribe mechanism for component lifecycle

- **[MEDIUM]** Implement preview URL management
  - Location: GenerationForm.svelte lines 258-266
  - Issue: Unlimited ObjectURL creation for previews
  - Risk: Memory leaks from unreleased blob references
  - Fix: Add preview limit (e.g., 50 most recent) and automatic cleanup

- **[MEDIUM]** Add device capability detection for cache sizing
  - Location: `src/lib/stores/resource-manager.ts:46-74`
  - Issue: Fixed 350MB cache allocation may exceed mobile device limits
  - Risk: Out-of-memory crashes on low-end devices
  - Fix: Dynamic cache sizing based on device memory and cores

## 🔧 Implementation Details

### GenerationForm.svelte Critical Fixes (Long-term Solution)

**Problem**: Immediate cleanup would disrupt generation logic (rarity distribution, strict pair tracking)

**Solution**: Implement persistent generation state that survives component unmount

```typescript
// 1. Create new persistent generation store
// src/lib/stores/generation-progress.svelte.ts
export const generationProgress = $state({
    isGenerating: false,
    currentIndex: 0,
    totalItems: 0,
    usedCombinations: new Map<string, Set<string>>(),
    strictPairState: null,
    projectConfig: null,
    startTime: null,
    lastUpdate: null,
    allImages: [],
    allMetadata: [],
    previews: [],
    error: null
});

// 2. Update GenerationForm.svelte onDestroy
onDestroy(() => {
    // Don't cancel generation - let it continue in background
    isComponentDestroyed = true;

    // Clean up UI resources only
    previews.forEach(p => URL.revokeObjectURL(p.url));

    // Remove UI-specific event listeners
    // Keep generation running with progress saved to persistent store

    // Optional: Set timeout to cancel if generation runs too long without user
    if (generationProgress.isGenerating) {
        setTimeout(() => {
            if (generationProgress.isGenerating && isComponentDestroyed) {
                cancelGenerationWithProgressSave();
            }
        }, 600000); // 10 minutes timeout
    }
});

// 3. Add graceful cancellation with state preservation
async function cancelGenerationWithProgressSave() {
    // Save current strict pair state before cancelling
    try {
        const progress = {
            currentIndex: generationProgress.currentIndex,
            usedCombinations: Array.from(generationProgress.usedCombinations.entries()),
            strictPairState: generationProgress.strictPairState,
            projectConfig: generationProgress.projectConfig,
            timestamp: Date.now()
        };

        sessionStorage.setItem('generation-progress-partial', JSON.stringify(progress));

        // Cancel the worker
        cancelGeneration();

        // Update progress store
        generationProgress.error = 'Generation paused. Resume from project page.';
        generationProgress.isGenerating = false;
    } catch (error) {
        console.error('Failed to save generation progress:', error);
        cancelGeneration();
    }
}

// 4. Add resume generation functionality
export async function resumeGeneration(savedProgress?: any) {
    if (savedProgress) {
        // Restore strict pair state
        const progress = JSON.parse(savedProgress);
        generationProgress.usedCombinations = new Map(progress.usedCombinations);
        generationProgress.currentIndex = progress.currentIndex;
        generationProgress.strictPairState = progress.strictPairState;

        // Resume generation from saved state
        // Worker needs to receive restored state to continue properly
    }
}
```

### Worker Pool Cleanup Fixes

```typescript
// Add to worker.pool.ts
export function cleanupWorkerPool(): void {
    if (!workerPool) return;

    // Clear background intervals
    if (workerPool.healthCheckInterval) {
        clearInterval(workerPool.healthCheckInterval);
        workerPool.healthCheckInterval = null;
    }
    if (workerPool.scalingInterval) {
        clearInterval(workerPool.scalingInterval);
        workerPool.scalingInterval = null;
    }

    // Clear task queue to prevent memory buildup
    workerPool.taskQueue = [];
    workerPool.activeTasks.clear();

    // Terminate all workers
    terminateWorkerPool();
}
```

### Resource Manager Device Detection

```typescript
// Add to resource-manager.ts constructor
private detectDeviceCapabilities() {
    const memoryGB = (navigator as any).deviceMemory || 4;
    const coreCount = navigator.hardwareConcurrency || 4;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    // Adjust cache sizes based on device capabilities
    const memoryMultiplier = isMobile ? 0.5 : 1.0;
    const coreMultiplier = Math.min(coreCount / 4, 2.0);

    this.imageBitmapCache = new ImageBitmapCache({
        maxSize: (100 * 1024 * 1024) * memoryMultiplier * coreMultiplier,
        // ... other config
    });
}
```

## 📊 Memory Usage Guidelines

- **Small collections (≤100 NFTs)**: <100MB - ✅ Safe
- **Medium collections (≤1000 NFTs)**: 100MB-500MB - ⚠️ Monitor
- **Large collections (≤5000 NFTs)**: 500MB-1GB - 🚨 Use streaming
- **Very large collections (>5000 NFTs)**: >1GB - ❌ Not recommended

## 🧪 Testing Requirements

- Test generation with 1000+ NFT collections on mobile devices
- Verify memory cleanup after navigating away during generation
- Test with multiple rapid generation start/cancel cycles
- Monitor memory usage with browser dev tools during large generations
- Test on low-memory devices (≤4GB RAM)

## 📈 Performance Metrics to Monitor

- Memory usage during generation (should stay <500MB)
- Worker pool task queue size (should not grow indefinitely)
- ObjectURL count (should be cleaned up on component destroy)
- Cache hit rates (should be >70% for optimal performance)
- Generation time per NFT (should not increase over time)

## 🎯 Success Criteria

### Memory & Performance
- [ ] No memory leaks when navigating away during generation
- [ ] Memory usage stays within device limits (<500MB)
- [ ] App remains responsive during large collection generation
- [ ] Background processes stop when not needed
- [ ] Cache sizes adapt to device capabilities

### Generation Logic Preservation
- [ ] Strict pair uniqueness maintained across component unmounts
- [ ] Rarity distribution preserved when generation resumes
- [ ] Users can navigate away and return to see generation progress
- [ ] Generation can be paused and resumed without data loss
- [ ] State persistence survives browser refreshes (optional)

### User Experience
- [ ] Visual indication of background generation progress
- [ ] Resume generation button appears when progress is saved
- [ ] Memory usage warnings with actionable recommendations
- [ ] Generation continues in background when tab is inactive
- [ ] Progress notifications when generation completes in background

## 🚀 Future Enhancements

### ✅ Phase 1 Complete: Memory Leak Fix Implementation
- ✅ Generation continues in background after component unmount
- ✅ Strict pair and rarity state preserved during background generation
- ✅ Proper memory cleanup without disrupting generation logic
- ✅ Session-based generation with unique tracking IDs
- ✅ Background generation notifications and controls
- ✅ Automatic timeout protection (10 minutes)
- ✅ Memory usage monitoring and warnings (<500MB limit)
- ❌ ~~Resume generation functionality~~ (Removed to prevent resource exhaustion)

### Phase 2: Enhanced Background Processing
- More granular background generation controls
- Progressive preview updates during background generation
- Memory usage optimization for large collections
- Background generation priority management

### Phase 3: Performance & Scalability
- Disk-based storage for very large collections (>5000 NFTs)
- Streaming generation for unlimited collection sizes
- Progressive preview loading during generation
- Intelligent memory management based on device capabilities
- Generation acceleration using WebGPU (if supported)

### Phase 4: Advanced Analytics & Optimization
- Generation performance analytics
- Rarity distribution visualization
- Generation bottleneck detection
- Automatic optimization suggestions
- Generation time prediction based on complexity

## 🔄 Migration Strategy

### Step 1: Create Persistent Generation Store
1. Create `src/lib/stores/generation-progress.svelte.ts`
2. Move generation state from component to store
3. Add sessionStorage persistence
4. Add state recovery functions

### Step 2: Update Worker Communication
1. Modify workers to send state to persistent store
2. Add state synchronization mechanisms
3. Implement pause/resume functionality in workers
4. Add progress saving checkpoints

### Step 3: Update UI Components
1. Modify GenerationForm to use persistent store
2. Add background generation indicators
3. Add resume generation UI
4. Update progress display for background state

### Step 4: Add Advanced Features
1. Implement generation notifications
2. Add generation history tracking
3. Add multiple project support
4. Add performance monitoring dashboard

## 📋 Implementation Checklist

### Core Features
- [ ] Create persistent generation state store
- [ ] Implement state serialization/deserialization
- [ ] Add worker state synchronization
- [ ] Update component lifecycle management
- [ ] Add resume generation functionality
- [ ] Implement background progress indicators

### Safety & Recovery
- [ ] Add generation timeout handling
- [ ] Implement crash recovery mechanisms
- [ ] Add data validation for restored state
- [ ] Add generation error recovery
- [ ] Implement graceful degradation

### Performance Optimizations
- [ ] Add memory usage monitoring
- [ ] Implement adaptive chunking based on device
- [ ] Add compression for stored state
- [ ] Optimize state update frequency
- [ ] Add garbage collection optimization
