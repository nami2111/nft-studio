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
	collectionSize: number
): CollectionComplexity {
	const factors = {
		layerCount: layers.length,
		traitCount: layers.reduce((sum, layer) => sum + (layer.traits?.length || 0), 0),
		collectionSize,
		hasComplexRules: layers.some(
			(layer) =>
				layer.traits?.some((trait) => trait.rulerRules && trait.rulerRules.length > 2) || false
		),
		averageTraitsPerLayer: 0
	};

	factors.averageTraitsPerLayer =
		factors.layerCount > 0 ? factors.traitCount / factors.layerCount : 0;

	// Simple collections: Fast linear algorithm
	if (
		factors.layerCount <= 12 &&
		factors.traitCount <= 100 &&
		collectionSize <= 15000 &&
		!factors.hasComplexRules
	) {
		return {
			type: 'simple',
			recommendedAlgorithm: 'fast-linear',
			estimatedSpeedup: '3-5x',
			reason: `Simple collection: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items`
		};
	}

	// Medium collections: Optimized existing algorithm
	if (factors.layerCount <= 20 && factors.traitCount <= 300 && collectionSize <= 25000) {
		return {
			type: 'medium',
			recommendedAlgorithm: 'optimized-existing',
			estimatedSpeedup: '1.5-2x',
			reason: `Medium complexity: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items`
		};
	}

	// Complex collections: Use existing sophisticated system
	return {
		type: 'complex',
		recommendedAlgorithm: 'existing-sophisticated',
		estimatedSpeedup: 'baseline',
		reason: `Complex collection: ${factors.layerCount} layers, ${factors.traitCount} traits, ${collectionSize} items, complex rules detected`
	};
}

/**
 * Check if fast generation is recommended for the given parameters
 */
export function shouldUseFastGeneration(
	layers: TransferrableLayer[],
	collectionSize: number
): boolean {
	const complexity = detectCollectionComplexity(layers, collectionSize);
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
