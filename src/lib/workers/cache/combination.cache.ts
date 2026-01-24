/**
 * OPTIMIZATION 1: Trait Combination Caching
 * Cache rendered trait combinations to avoid re-processing identical combinations
 */
export class TraitCombinationCache {
    private combinationCache = new Map<
        string,
        {
            canvas: OffscreenCanvas;
            accessTime: number;
            accessCount: number;
            creationTime: number;
        }
    >();

    private maxCombinations: number;
    private maxMemoryBytes: number;
    private currentMemoryUsage = 0;

    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        savedRenderingTime: 0
    };

    constructor() {
        // Cache up to 50 combinations for each 1GB of device memory, capped at 500
        const deviceMemoryGB = (navigator as any).deviceMemory || 4;
        this.maxCombinations = Math.min(deviceMemoryGB * 50, 500);
        // Allocate 10% of device memory for combination cache
        this.maxMemoryBytes = Math.min(deviceMemoryGB * 1024 * 1024 * 1024 * 0.1, 200 * 1024 * 1024); // Cap at 200MB

        console.log(
            `🎨 Trait Combination Cache initialized: ${this.maxCombinations} max combinations, ` +
            `${(this.maxMemoryBytes / 1024 / 1024).toFixed(1)}MB max`
        );
    }

    /**
     * Generate cache key from trait combination
     * Key is sorted trait IDs joined by pipe for consistent lookups
     */
    private generateKey(traitIds: string[]): string {
        return [...traitIds].sort().join('|');
    }

    /**
     * Get cached combination canvas if available
     */
    get(traitIds: string[]): OffscreenCanvas | undefined {
        const key = this.generateKey(traitIds);
        const entry = this.combinationCache.get(key);

        if (entry) {
            entry.accessTime = Date.now();
            entry.accessCount++;
            this.stats.hits++;
            return entry.canvas;
        }

        this.stats.misses++;
        return undefined;
    }

    /**
     * Cache a rendered trait combination
     * For memory efficiency, we estimate canvas size based on typical PNG compression
     */
    set(traitIds: string[], canvas: OffscreenCanvas): void {
        const key = this.generateKey(traitIds);

        // Estimate canvas memory footprint (rough: width * height * 4 bytes * 0.3 compression)
        const estimatedSize = canvas.width * canvas.height * 4 * 0.3;

        // Check memory pressure
        if (
            this.currentMemoryUsage + estimatedSize > this.maxMemoryBytes ||
            this.combinationCache.size >= this.maxCombinations
        ) {
            this.evictEntries(estimatedSize);
        }

        // Don't cache if it's too large relative to our budget
        if (estimatedSize > this.maxMemoryBytes * 0.2) {
            return;
        }

        this.combinationCache.set(key, {
            canvas,
            accessTime: Date.now(),
            accessCount: 1,
            creationTime: Date.now()
        });

        this.currentMemoryUsage += estimatedSize;
    }

    /**
     * Evict least valuable entries based on access frequency and age
     */
    private evictEntries(requiredSpace: number): void {
        const entries = Array.from(this.combinationCache.entries());

        // Score entries: (accessCount / ageDays) - higher score = more valuable
        const scoredEntries = entries.map(([key, entry]) => {
            const ageDays = (Date.now() - entry.creationTime) / (1000 * 60 * 60 * 24);
            const value = entry.accessCount / Math.max(1, ageDays);
            return { key, entry, value };
        });

        // Sort by value (descending) - keep high-value items
        scoredEntries.sort((a, b) => b.value - a.value);

        let freedSpace = 0;
        const maxEvictions = Math.min(scoredEntries.length, 10);

        for (
            let i = scoredEntries.length - 1;
            i >= 0 && freedSpace < requiredSpace && maxEvictions > 0;
            i--
        ) {
            const { key, entry } = scoredEntries[i];
            const estimatedSize = entry.canvas.width * entry.canvas.height * 4 * 0.3;
            this.combinationCache.delete(key);
            this.currentMemoryUsage -= estimatedSize;
            freedSpace += estimatedSize;
            this.stats.evictions++;
        }
    }

    clear(): void {
        this.combinationCache.clear();
        this.currentMemoryUsage = 0;
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.stats.evictions = 0;
        this.stats.savedRenderingTime = 0;
    }

    get size(): number {
        return this.combinationCache.size;
    }

    getStats() {
        const totalOps = this.stats.hits + this.stats.misses;
        const hitRate = totalOps > 0 ? (this.stats.hits / totalOps) * 100 : 0;

        return {
            ...this.stats,
            hitRate: hitRate.toFixed(1),
            cachedCombinations: this.combinationCache.size,
            maxCombinations: this.maxCombinations,
            memoryUsageMB: (this.currentMemoryUsage / 1024 / 1024).toFixed(1),
            maxMemoryMB: (this.maxMemoryBytes / 1024 / 1024).toFixed(1),
            memoryUtilization: ((this.currentMemoryUsage / this.maxMemoryBytes) * 100).toFixed(1)
        };
    }
}
