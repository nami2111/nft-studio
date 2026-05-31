/**
 * Smart constraint cache for ruler rules.
 *
 * Caches the set of compatible target traits for a given (sourceLayer, sourceTrait, targetLayer)
 * triple, so the solver doesn't re-evaluate ruler rules on every constraint check.
 * Tracks hit rate and access count for monitoring.
 */
export class ConstraintCache {
	compatiblePairs = new Map<string, Set<string>>();
	constraintHashes = new Map<string, string>();
	hitRate = 0;
	accessCount = 0;
	private hits = 0;

	get(fromTraitId: string, fromLayerId: string, targetLayerId: string): Set<string> | undefined {
		const cacheKey = `${fromLayerId}_${fromTraitId}_${targetLayerId}`;
		this.accessCount++;
		const result = this.compatiblePairs.get(cacheKey);
		if (result) {
			this.hits++;
			this.hitRate = (this.hits / this.accessCount) * 100;
		}
		return result;
	}

	set(
		fromTraitId: string,
		fromLayerId: string,
		targetLayerId: string,
		compatibleTraits: Set<string>
	): void {
		const cacheKey = `${fromLayerId}_${fromTraitId}_${targetLayerId}`;
		this.compatiblePairs.set(cacheKey, new Set(compatibleTraits));
	}

	clear(): void {
		this.compatiblePairs.clear();
		this.constraintHashes.clear();
		this.hitRate = 0;
		this.accessCount = 0;
		this.hits = 0;
	}

	getStats() {
		return {
			hitRate: this.hitRate.toFixed(1),
			accessCount: this.accessCount,
			hits: this.hits,
			cacheSize: this.compatiblePairs.size
		};
	}
}
