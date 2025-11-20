// CSP Solver for NFT Generation
// Implements a backtracking algorithm to find valid trait combinations
// respecting Strict Pair and Ruler rules.

import type { TransferrableLayer, TransferrableTrait } from '$lib/types/worker-messages';

interface SolverContext {
	layers: TransferrableLayer[];
	selectedTraits: Map<string, TransferrableTrait>;
	usedCombinations: Map<string, Set<string>>;
	strictPairConfig?: {
		enabled: boolean;
		layerCombinations: Array<{
			id: string;
			layerIds: string[];
			active: boolean;
		}>;
	};
}

export class CSPSolver {
	private context: SolverContext;

	constructor(
		layers: TransferrableLayer[],
		usedCombinations: Map<string, Set<string>>,
		strictPairConfig?: SolverContext['strictPairConfig']
	) {
		this.context = {
			layers,
			selectedTraits: new Map(),
			usedCombinations,
			strictPairConfig
		};
	}

	solve(): Map<string, TransferrableTrait> | null {
		return this.backtrack(0);
	}

	private backtrack(layerIndex: number): Map<string, TransferrableTrait> | null {
		// Base case: all layers processed
		if (layerIndex >= this.context.layers.length) {
			if (this.isValidCombination()) {
				return new Map(this.context.selectedTraits);
			}
			return null;
		}

		const layer = this.context.layers[layerIndex];

		// Handle optional layers
		if (layer.isOptional) {
			// Try skipping this layer
			const result = this.backtrack(layerIndex + 1);
			if (result) return result;
		}

		// Get candidate traits (shuffled for randomness)
		const candidates = this.getCandidates(layer);

		for (const trait of candidates) {
			// Check local constraints (Ruler rules)
			if (this.isTraitValid(trait, layer.id)) {
				// Place trait
				this.context.selectedTraits.set(layer.id, trait);

				// Recurse
				const result = this.backtrack(layerIndex + 1);
				if (result) return result;

				// Backtrack
				this.context.selectedTraits.delete(layer.id);
			}
		}

		return null;
	}

	private getCandidates(layer: TransferrableLayer): TransferrableTrait[] {
		const traits = [...layer.traits];
		// Shuffle traits to ensure random distribution among equal weights
		for (let i = traits.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[traits[i], traits[j]] = [traits[j], traits[i]];
		}
		return traits;
	}

	private isTraitValid(trait: TransferrableTrait, layerId: string): boolean {
		// Check Ruler rules against already selected traits
		for (const [selectedLayerId, selectedTrait] of this.context.selectedTraits) {
			// Check if selected trait forbids the new trait
			if (selectedTrait.type === 'ruler' && selectedTrait.rulerRules) {
				const rule = selectedTrait.rulerRules.find((r) => r.layerId === layerId);
				if (rule) {
					if (rule.forbiddenTraitIds.includes(trait.id)) return false;
					if (rule.allowedTraitIds.length > 0 && !rule.allowedTraitIds.includes(trait.id))
						return false;
				}
			}

			// Check if new trait forbids the selected trait (if new trait is also ruler)
			if (trait.type === 'ruler' && trait.rulerRules) {
				const rule = trait.rulerRules.find((r) => r.layerId === selectedLayerId);
				if (rule) {
					if (rule.forbiddenTraitIds.includes(selectedTrait.id)) return false;
					if (rule.allowedTraitIds.length > 0 && !rule.allowedTraitIds.includes(selectedTrait.id))
						return false;
				}
			}
		}
		return true;
	}

	private isValidCombination(): boolean {
		// Check Strict Pair uniqueness
		if (!this.context.strictPairConfig?.enabled) return true;

		for (const layerCombination of this.context.strictPairConfig.layerCombinations) {
			if (!layerCombination.active) continue;

			// Check if all layers in this combination are present in the selection
			const traitIds: string[] = [];
			let allLayersPresent = true;

			for (const layerId of layerCombination.layerIds) {
				const trait = this.context.selectedTraits.get(layerId);
				if (trait) {
					traitIds.push(trait.id);
				} else {
					// If a required layer for this rule is missing (e.g. optional layer skipped),
					// then this rule doesn't apply (or should it? usually strict pair implies presence)
					// Assuming if layer is missing, the combination is distinct from one where it's present.
					// But here we are checking if the *combination of traits* has been seen.
					// If a layer is missing, we can't form the combination key as defined by "layerIds".
					// So we skip this rule check.
					allLayersPresent = false;
					break;
				}
			}

			if (!allLayersPresent) continue;

			const combinationKey = traitIds.sort().join('|');
			const usedSet = this.context.usedCombinations.get(layerCombination.id);

			if (usedSet && usedSet.has(combinationKey)) {
				return false; // Already used
			}
		}

		return true;
	}
}
