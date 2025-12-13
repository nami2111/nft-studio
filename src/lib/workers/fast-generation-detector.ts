// src/lib/workers/fast-generation-detector.ts

import type { TransferrableLayer } from '$lib/types/worker-messages';

export interface CollectionComplexity {
	type: 'simple' | 'medium' | 'complex';
	recommendedAlgorithm: 'fast-linear' | 'optimized-existing' | 'existing-sophisticated';
	estimatedSpeedup: string;
	reason: string;
}

/**
 * Detect if a collection can benefit from fast generation algorithms
 * Simple collections get 3-5x speed improvements
 */
export function detectCollectionComplexity(
	layers: TransferrableLayer[],
	collectionSize: number,
	strictPairConfig?: { enabled: boolean; layerCombinations: Array<{ id: string; layerIds: string[]; description: string; active: boolean }> }
): CollectionComplexity {
	const factors = {
		layerCount: layers.length,
		traitCount: layers.reduce((sum, layer) => sum + (layer.traits?.length || 0), 0),
		collectionSize,
		hasRulerRules: false,
		hasComplexRulerRules: false,
		hasStrictPair: false,
		averageTraitsPerLayer: 0,
		totalConstraints: 0
	};

	factors.averageTraitsPerLayer =
		factors.layerCount > 0 ? factors.traitCount / factors.layerCount : 0;

	// Analyze ruler rules complexity
	for (const layer of layers) {
		if (!layer.traits) continue;

		for (const trait of layer.traits) {
			if (trait.rulerRules && trait.rulerRules.length > 0) {
				factors.hasRulerRules = true;
				factors.totalConstraints += trait.rulerRules.length;

				// Check if any ruler rule is complex (has many constraints)
				for (const rule of trait.rulerRules) {
					const constraintCount = rule.allowedTraitIds.length + rule.forbiddenTraitIds.length;
					if (constraintCount > 2) {
						factors.hasComplexRulerRules = true;
					}
				}
			}
		}
	}

	// Check for strict pair constraints
	if (strictPairConfig?.enabled && strictPairConfig.layerCombinations.some(lc => lc.active)) {
		factors.hasStrictPair = true;
		factors.totalConstraints += strictPairConfig.layerCombinations.filter(lc => lc.active).length;
	}

	// Check if collection has inter-layer dependencies that would make fast generation unreliable
	const hasInterLayerDependencies = checkInterLayerDependencies(layers);

	// Simple collections: Fast linear algorithm
	if (
		factors.layerCount <= 3 &&
		factors.traitCount <= 20 &&
		collectionSize <= 500 &&
		!factors.hasRulerRules && // No ruler rules at all
		!factors.hasStrictPair && // No strict pair constraints
		!hasInterLayerDependencies // No complex inter-layer dependencies
	) {
		return {
			type: 'simple',
			recommendedAlgorithm: 'fast-linear',
			estimatedSpeedup: '3-5x',
			reason: `Ultra-simple collection: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items, no constraints`
		};
	}

	// Simple-moderate collections: Fast generation with constraint support
	if (
		factors.layerCount <= 8 &&
		factors.traitCount <= 50 &&
		collectionSize <= 2000 &&
		factors.totalConstraints <= 10 && // Limited number of constraints
		!factors.hasComplexRulerRules && // No overly complex ruler rules
		!hasInterLayerDependencies // No complex inter-layer dependencies
	) {
		return {
			type: 'simple',
			recommendedAlgorithm: 'fast-linear',
			estimatedSpeedup: '2-3x',
			reason: `Simple collection with constraints: ${factors.layerCount} layers, ${factors.traitCount} traits, ${factors.totalConstraints} constraints`
		};
	}

	// Medium collections: Optimized existing algorithm
	if (
		factors.layerCount <= 20 &&
		factors.traitCount <= 300 &&
		collectionSize <= 10000 &&
		factors.totalConstraints <= 50 // Reasonable constraint count
	) {
		return {
			type: 'medium',
			recommendedAlgorithm: 'optimized-existing',
			estimatedSpeedup: '1.5-2x',
			reason: `Medium complexity: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items, ${factors.totalConstraints} constraints`
		};
	}

	// Complex collections: Use existing sophisticated system
	return {
		type: 'complex',
		recommendedAlgorithm: 'existing-sophisticated',
		estimatedSpeedup: 'baseline',
		reason: `Complex collection: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items, ${factors.totalConstraints} constraints`
	};
}

/**
 * Check if collection has complex inter-layer dependencies
 */
function checkInterLayerDependencies(layers: TransferrableLayer[]): boolean {
	// Build dependency graph
	const dependencies = new Map<string, Set<string>>();

	for (const layer of layers) {
		dependencies.set(layer.id, new Set<string>());
	}

	// Check all ruler rules to build dependency graph
	for (const layer of layers) {
		if (!layer.traits) continue;

		for (const trait of layer.traits) {
			if (trait.rulerRules) {
				for (const rule of trait.rulerRules) {
					dependencies.get(layer.id)?.add(rule.layerId);
				}
			}
		}
	}

	// Check for circular dependencies or complex chains
	for (const [layerId, deps] of dependencies) {
		if (deps.size > 2) {
			// Layer affects more than 2 other layers - complex dependency
			return true;
		}

		// Check for circular dependencies
		for (const depLayerId of deps) {
			if (dependencies.get(depLayerId)?.has(layerId)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if fast generation is recommended for the given parameters
 */
export function shouldUseFastGeneration(
	layers: TransferrableLayer[],
	collectionSize: number,
	strictPairConfig?: { enabled: boolean; layerCombinations: Array<{ id: string; layerIds: string[]; description: string; active: boolean }> }
): boolean {
	const complexity = detectCollectionComplexity(layers, collectionSize, strictPairConfig);
	return complexity.type === 'simple';
}

/**
 * Get optimization hints based on collection characteristics
 */
export function getOptimizationHints(
	layers: TransferrableLayer[],
	collectionSize: number
): string[] {
	const hints: string[] = [];
	const complexity = detectCollectionComplexity(layers, collectionSize);

	if (complexity.type === 'simple') {
		hints.push('🎯 Fast generation recommended (3-5x speed improvement)');
		hints.push('🚀 Parallel canvas composition will be enabled');
		hints.push('📊 Progress updates will be batched for better performance');
	} else if (complexity.type === 'medium') {
		hints.push('⚡ Optimized generation mode (1.5-2x speed improvement)');
		hints.push('🔧 Reduced caching overhead for better performance');
	} else {
		hints.push('🏗️ Using sophisticated generation for complex constraints');
		hints.push('⏱️ Generation may take longer due to complexity');
	}

	// Add specific optimization suggestions
	if (collectionSize > 10000) {
		hints.push('💾 Consider batch processing for large collections');
	}

	const totalTraits = layers.reduce((sum, layer) => sum + (layer.traits?.length || 0), 0);
	if (totalTraits > 100) {
		hints.push('🧠 High trait count detected - constraint optimization enabled');
	}

	return hints;
}
