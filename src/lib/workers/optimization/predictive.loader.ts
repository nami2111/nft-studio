/**
 * OPTIMIZATION 3: Predictive Loading
 * Predict and preload traits likely to be needed based on patterns
 */
export class PredictiveTraitLoader {
	private loadHistory: string[][] = []; // Store trait combinations in order
	private patternFrequency = new Map<string, number>(); // Pattern -> frequency
	private currentBatch = 0;

	private pendingPredictions: string[] = [];

	private stats = {
		predictionsAttempted: 0,
		successfulPredictions: 0,
		prefetchedItems: 0
	};

	/**
	 * Record a trait combination used in generation.
	 * Also evaluates the previous prediction set against this combination,
	 * and generates a new prediction set for the next item.
	 */
	recordCombination(traitIds: string[]): { patternFrequency: number; predictions: string[] } {
		// Evaluate previous predictions against the current combination
		if (this.pendingPredictions.length > 0) {
			const matched = this.pendingPredictions.some((predictedTraitId) =>
				traitIds.includes(predictedTraitId)
			);
			if (matched) {
				this.stats.successfulPredictions++;
			}
			this.pendingPredictions = [];
		}

		this.loadHistory.push([...traitIds]);

		// Keep only recent history (last 100 combinations)
		if (this.loadHistory.length > 100) {
			this.loadHistory.shift();
		}

		// Update pattern frequency
		const pattern = [...traitIds].sort().join('|');
		const nextFrequency = (this.patternFrequency.get(pattern) || 0) + 1;
		this.patternFrequency.set(pattern, nextFrequency);

		// Predict next traits (attempted even if it returns an empty array)
		const predictions = this.predictNextTraits(traitIds);
		if (this.loadHistory.length >= 3) {
			this.stats.predictionsAttempted++;
			this.pendingPredictions = predictions;
		}

		return { patternFrequency: nextFrequency, predictions };
	}

	/**
	 * Predict likely next traits based on current patterns
	 * Returns top predicted trait IDs sorted by probability
	 */
	predictNextTraits(currentTraitIds: string[]): string[] {
		if (this.loadHistory.length < 3) {
			return []; // Not enough data to predict
		}

		const predicted = new Map<string, number>(); // traitId -> score
		const currentPattern = [...currentTraitIds].sort().join('|');

		// Find similar patterns in history
		for (const [pattern, frequency] of this.patternFrequency) {
			if (this.isSimilarPattern(pattern, currentPattern)) {
				// Extract unique traits from pattern
				const patternTraits = pattern.split('|');
				for (const trait of patternTraits) {
					if (!currentTraitIds.includes(trait)) {
						predicted.set(trait, (predicted.get(trait) || 0) + frequency);
					}
				}
			}
		}

		// Sort by score and return top predictions
		return Array.from(predicted.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([trait]) => trait);
	}

	/**
	 * Check if two patterns are similar (share 70% of traits)
	 */
	private isSimilarPattern(pattern1: string, pattern2: string): boolean {
		const traits1 = new Set(pattern1.split('|'));
		const traits2 = new Set(pattern2.split('|'));

		const intersection = new Set([...traits1].filter((x) => traits2.has(x)));
		const union = new Set([...traits1, ...traits2]);

		const similarity = intersection.size / Math.max(1, union.size);
		return similarity >= 0.7;
	}

	clear(): void {
		this.loadHistory = [];
		this.patternFrequency.clear();
		this.currentBatch = 0;
		this.pendingPredictions = [];
		this.stats.predictionsAttempted = 0;
		this.stats.successfulPredictions = 0;
		this.stats.prefetchedItems = 0;
	}

	getStats() {
		return {
			...this.stats,
			historicalCombinations: this.loadHistory.length,
			uniquePatterns: this.patternFrequency.size
		};
	}
}
