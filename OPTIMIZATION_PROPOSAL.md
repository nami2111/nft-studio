# Sequential Generation Optimization Proposal

## Current Performance: 7.8 NFTs/second
## Target Performance: 12-15 NFTs/second (50-90% improvement)

## Key Optimizations for Sequential Processing

### 1. **Batch Canvas Operations**
Instead of processing each layer individually, group operations together:

```typescript
// Current (Slow - individual layer processing)
for (const layer of layers) {
  const image = await loadTraitImage(layer.trait);
  ctx.drawImage(image, 0, 0, width, height);
}

// Optimized (Fast - batch processing)
async function batchCompositeLayers(layers, canvas, ctx) {
  // Pre-load all images in parallel
  const imagePromises = layers.map(async layer => {
    const image = await loadTraitImage(layer.trait);
    return { layer, image };
  });
  
  const loadedImages = await Promise.all(imagePromises);
  
  // Batch draw all images at once
  for (const { layer, image } of loadedImages) {
    ctx.drawImage(image, 0, 0, width, height);
  }
}
```

### 2. **Micro-Batch Processing Pipeline**
Process NFTs in small micro-batches (5-10 items) instead of one-by-one:

```typescript
async function processMicroBatch(startIndex, batchSize) {
  const batchPromises = [];
  
  for (let i = 0; i < batchSize; i++) {
    const index = startIndex + i;
    if (index >= collectionSize) break;
    
    batchPromises.push(generateSingleNFT(index));
  }
  
  // Process batch with shared resources
  const results = await Promise.all(batchPromises);
  
  // Batch transfer to reduce message overhead
  await transferBatchResults(results);
}
```

### 3. **Optimized Memory Management**
Reduce GC pressure with better memory pooling:

```typescript
class OptimizedMemoryManager {
  private canvasPool: HTMLCanvasElement[] = [];
  private imageDataPool: Uint8ClampedArray[] = [];
  
  getCanvas() {
    return this.canvasPool.pop() || document.createElement('canvas');
  }
  
  returnCanvas(canvas: HTMLCanvasElement) {
    // Reset canvas efficiently
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.canvasPool.push(canvas);
  }
}
```

### 4. **Enhanced Caching Strategy**
Pre-calculate common layer combinations and use sprite sheets:

```typescript
class CombinationCache {
  private spriteSheetCache = new Map<string, OffscreenCanvas>();
  private combinationIndex = new Map<string, number>();
  
  // Pre-cache frequently used combinations
  async function preloadCommonCombinations(layers) {
    const commonCombinations = this.findMostCommonCombinations(layers);
    
    for (const combination of commonCombinations) {
      const cachedImage = await this.createSpriteSheet(combination);
      this.spriteSheetCache.set(combination.id, cachedImage);
    }
  }
  
  // Use cached sprite sheets for instant rendering
  async function getCachedCombination(combinationId: string) {
    return this.spriteSheetCache.get(combinationId);
  }
}
```

### 5. **Streamlined Progress Updates**
Reduce progress message frequency and batch progress updates:

```typescript
class ProgressManager {
  private lastProgressTime = 0;
  private pendingProgress = new Map<number, number>();
  
  updateProgress(currentIndex, totalCount) {
    const now = Date.now();
    
    // Only update progress every 500ms or every 20 items
    if (now - this.lastProgressTime > 500 || currentIndex % 20 === 0) {
      this.sendProgress(currentIndex, totalCount);
      this.lastProgressTime = now;
    }
  }
}
```

### 6. **Optimized Blob Creation**
Use more efficient blob creation and transfer:

```typescript
async function createOptimizedBlob(canvas, quality = 0.9) {
  // Use toBlob instead of dataURL for better performance
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png', quality);
  });
}

// Batch blob processing
async function processBatchBlobs(canvasArray) {
  const blobPromises = canvasArray.map(canvas => createOptimizedBlob(canvas));
  return Promise.all(blobPromises);
}
```

## Implementation Priority

### Phase 1: Quick Wins (2-3x speed improvement)
1. **Batch Canvas Operations** - Group layer processing
2. **Micro-Batch Processing** - Process 5-10 NFTs together
3. **Optimized Progress Updates** - Reduce message frequency

### Phase 2: Memory Optimization (1.5x speed improvement)
1. **Memory Pooling** - Reuse canvas and image data
2. **Smart Caching** - Pre-cache common combinations
3. **Efficient Blob Creation** - Use toBlob instead of dataURL

### Phase 3: Advanced Optimization (1.2x speed improvement)
1. **Sprite Sheet Preloading** - Instant rendering for common traits
2. **Transferable Object Pool** - Reuse ArrayBuffer transfers
3. **Predictive Caching** - Pre-load likely next combinations

## Expected Performance Gains

- **Phase 1**: 7.8 → 15-20 NFTs/second (100-150% improvement)
- **Phase 2**: 15-20 → 22-25 NFTs/second (additional 40-50% improvement)
- **Phase 3**: 22-25 → 25-30 NFTs/second (additional 15-20% improvement)

**Total Expected**: 7.8 → 25-30 NFTs/second (220-280% improvement)

## Code Changes Required

The optimizations require minimal changes to your existing sequential architecture:
1. Add micro-batch processing in generation.worker.ts
2. Implement memory pooling for canvas objects
3. Optimize progress message frequency
4. Add combination caching for common traits
5. Batch blob creation and transfers

All changes maintain your sequential processing model while dramatically improving throughput.