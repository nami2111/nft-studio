/**
 * Rarity Calculator - Calculate trait rarity and NFT rarity scores
 * Implements multiple rarity calculation methods with enhanced features
 */

import type { GalleryNFT, GalleryCollection } from '$lib/types/gallery';

export interface TraitRarity {
	layer: string;
	trait: string;
	count: number;
	percentage: number;
	rarityScore: number;
}

export interface EnhancedTraitRarity extends TraitRarity {
	weight: number; // Custom weight factor
	influence: 'high' | 'medium' | 'low'; // Visual indicator
	tier: number; // 1-10 tier system
	strategicValue: 'strategic' | 'balanced' | 'filler'; // Classification
	emergentRarity?: boolean; // Whether this trait gains rarity from combinations
}

export interface LayerImportance {
	layer: string;
	importance: 'high' | 'medium' | 'low';
	weight: number; // Multiplier for layer impact (1.0 = neutral)
}

export interface RarityTier {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

export interface StrategicCombination {
	strategic: number; // High-value combinations
	balanced: number; // Medium-value combinations
	filler: number; // Low-value combinations
}

/**
 * Rarity calculation methods
 */
export enum RarityMethod {
	TRAIT_RARITY = 'trait_rarity', // Sum of individual trait rarities
	AVERAGE_TRAIT_RARITY = 'average_trait_rarity', // Average of trait rarities
	WEIGHTED_TRAIT_RARITY = 'weighted_trait_rarity', // Weighted by layer importance
	STANDARD_DEVIATION = 'standard_deviation', // Based on statistical deviation
	ENHANCED_WEIGHTED = 'enhanced_weighted', // Custom weights + tiered system
	EMERGENT_RARITY = 'emergent_rarity' // Combinations create new rarity
}

/**
 * Default rarity tiers
 */
export const DEFAULT_RARITY_TIERS: RarityTier[] = [
	{ name: 'Common', minScore: 0, maxScore: 2, color: '#64748b' },
	{ name: 'Uncommon', minScore: 2, maxScore: 5, color: '#22c55e' },
	{ name: 'Rare', minScore: 5, maxScore: 10, color: '#3b82f6' },
	{ name: 'Epic', minScore: 10, maxScore: 25, color: '#a855f7' },
	{ name: 'Legendary', minScore: 25, maxScore: Infinity, color: '#ef4444' }
];

/**
 * Default layer importance weights
 */
export const DEFAULT_LAYER_IMPORTANCE: LayerImportance[] = [];

/**
 * Calculate trait rarities for a collection
 */
export function calculateTraitRarities(collection: GalleryCollection): Map<string, TraitRarity> {
	const traitMap = new Map<string, { count: number; layer: string; trait: string }>();
	const totalNFTs = collection.nfts.length;

	// Count occurrences of each trait
	for (const nft of collection.nfts) {
		for (const trait of nft.metadata.traits) {
			const layer = trait.layer || (trait as any).trait_type;
			const traitValue = trait.trait || (trait as any).value;
			const key = `${layer}:${traitValue}`;
			const existing = traitMap.get(key);
			if (existing) {
				existing.count++;
			} else {
				traitMap.set(key, {
					count: 1,
					layer: layer,
					trait: traitValue
				});
			}
		}
	}

	// Calculate percentages and rarity scores
	const rarityMap = new Map<string, TraitRarity>();
	for (const [key, data] of traitMap) {
		const percentage = (data.count / totalNFTs) * 100;
		const rarityScore = 100 / percentage; // Higher score for rarer traits

		rarityMap.set(key, {
			layer: data.layer,
			trait: data.trait,
			count: data.count,
			percentage,
			rarityScore
		});
	}

	return rarityMap;
}

/**
 * Calculate enhanced trait rarities with custom weights and tiers
 */
export function calculateEnhancedTraitRarities(
	collection: GalleryCollection,
	layerImportance: LayerImportance[] = DEFAULT_LAYER_IMPORTANCE,
	customWeights: Map<string, number> = new Map(),
	tiers: RarityTier[] = DEFAULT_RARITY_TIERS
): Map<string, EnhancedTraitRarity> {
	const traitMap = new Map<string, { count: number; layer: string; trait: string }>();
	const totalNFTs = collection.nfts.length;

	// Count occurrences of each trait
	for (const nft of collection.nfts) {
		for (const trait of nft.metadata.traits) {
			const layer = trait.layer || (trait as any).trait_type;
			const traitValue = trait.trait || (trait as any).value;
			const key = `${layer}:${traitValue}`;
			const existing = traitMap.get(key);
			if (existing) {
				existing.count++;
			} else {
				traitMap.set(key, {
					count: 1,
					layer: layer,
					trait: traitValue
				});
			}
		}
	}

	// Calculate enhanced rarity data
	const enhancedRarityMap = new Map<string, EnhancedTraitRarity>();
	for (const [key, data] of traitMap) {
		const percentage = (data.count / totalNFTs) * 100;
		const baseRarityScore = 100 / percentage;

		// Get layer importance weight
		const layerInfo = layerImportance.find((li) => li.layer === data.layer);
		const layerWeight = layerInfo?.weight || 1.0;

		// Get custom weight
		const customWeight = customWeights.get(key) || 1.0;

		// Calculate enhanced rarity score
		const enhancedScore = baseRarityScore * layerWeight * customWeight;

		// Determine tier and classification
		const tier = getRarityTier(enhancedScore, tiers);
		const influence = getInfluenceLevel(enhancedScore);
		const strategicValue = classifyStrategicValue(enhancedScore, percentage);

		enhancedRarityMap.set(key, {
			layer: data.layer,
			trait: data.trait,
			count: data.count,
			percentage,
			rarityScore: enhancedScore,
			weight: customWeight,
			influence,
			tier,
			strategicValue
		});
	}

	return enhancedRarityMap;
}

/**
 * Calculate rarity scores for all NFTs in a collection
 */
export function calculateNFTRarities(
	collection: GalleryCollection,
	method: RarityMethod = RarityMethod.TRAIT_RARITY
): {
	traitRarities: Map<string, TraitRarity>;
	nftRarities: any[];
	rarestNFT: GalleryNFT;
	mostCommonNFT: GalleryNFT;
} {
	// Use enhanced calculation for new methods
	if (method === RarityMethod.ENHANCED_WEIGHTED) {
		return calculateEnhancedNFTRarities(collection);
	}
	if (method === RarityMethod.EMERGENT_RARITY) {
		return calculateEmergentNFTRarities(collection);
	}

	// Original calculation for backward compatibility
	const traitRarities = calculateTraitRarities(collection);
	const nftRarities: Array<{
		nft: GalleryNFT;
		rarityScore: number;
		traitRarities: TraitRarity[];
	}> = [];

	for (const nft of collection.nfts) {
		const traitRarityData: TraitRarity[] = [];
		let totalScore = 0;

		for (const trait of nft.metadata.traits) {
			const layer = trait.layer || (trait as any).trait_type;
			const traitValue = trait.trait || (trait as any).value;
			const key = `${layer}:${traitValue}`;
			const traitRarity = traitRarities.get(key);
			if (traitRarity) {
				traitRarityData.push(traitRarity);
				totalScore += traitRarity.rarityScore;
			}
		}

		// Apply calculation method
		let finalScore = totalScore;
		switch (method) {
			case RarityMethod.AVERAGE_TRAIT_RARITY:
				finalScore = traitRarityData.length > 0 ? totalScore / traitRarityData.length : 0;
				break;
			case RarityMethod.WEIGHTED_TRAIT_RARITY:
				// Later traits (higher layers) get higher weight
				finalScore = traitRarityData.reduce((score, trait, index) => {
					const weight = (index + 1) / traitRarityData.length;
					return score + trait.rarityScore * weight;
				}, 0);
				break;
			case RarityMethod.STANDARD_DEVIATION:
				// Calculate statistical rarity based on trait distribution
				const mean = totalScore / traitRarityData.length;
				const variance =
					traitRarityData.reduce((sum, trait) => {
						return sum + Math.pow(trait.rarityScore - mean, 2);
					}, 0) / traitRarityData.length;
				finalScore = Math.sqrt(variance);
				break;
		}

		nftRarities.push({
			nft,
			rarityScore: finalScore,
			traitRarities: traitRarityData
		});
	}

	// Sort by rarity score (descending)
	nftRarities.sort((a, b) => b.rarityScore - a.rarityScore);

	// Update NFTs with rarity data
	const updatedNFTs = nftRarities.map((data, index) => ({
		...data.nft,
		rarityScore: data.rarityScore,
		rarityRank: index + 1
	}));

	// Find rarest and most common
	const rarestNFT = updatedNFTs[0];
	const mostCommonNFT = updatedNFTs[updatedNFTs.length - 1];

	return {
		traitRarities,
		nftRarities,
		rarestNFT,
		mostCommonNFT
	};
}

/**
 * Calculate enhanced NFT rarities using custom weights and tiers
 */
export function calculateEnhancedNFTRarities(
	collection: GalleryCollection,
	layerImportance: LayerImportance[] = DEFAULT_LAYER_IMPORTANCE,
	customWeights: Map<string, number> = new Map(),
	tiers: RarityTier[] = DEFAULT_RARITY_TIERS
): any {
	const enhancedTraitRarities = calculateEnhancedTraitRarities(
		collection,
		layerImportance,
		customWeights,
		tiers
	);
	const nftRarities: any[] = [];

	for (const nft of collection.nfts) {
		const traitRarityData: EnhancedTraitRarity[] = [];
		let totalScore = 0;
		let strategicCount = 0;
		let balancedCount = 0;
		let fillerCount = 0;

		for (const trait of nft.metadata.traits) {
			const layer = trait.layer || (trait as any).trait_type;
			const traitValue = trait.trait || (trait as any).value;
			const key = `${layer}:${traitValue}`;
			const traitRarity = enhancedTraitRarities.get(key);
			if (traitRarity) {
				traitRarityData.push(traitRarity);
				totalScore += traitRarity.rarityScore;

				// Count strategic values
				switch (traitRarity.strategicValue) {
					case 'strategic':
						strategicCount++;
						break;
					case 'balanced':
						balancedCount++;
						break;
					case 'filler':
						fillerCount++;
						break;
				}
			}
		}

		nftRarities.push({
			nft,
			rarityScore: totalScore,
			traitRarities: traitRarityData,
			strategicBreakdown: {
				strategic: strategicCount,
				balanced: balancedCount,
				filler: fillerCount
			}
		});
	}

	// Sort by rarity score (descending)
	nftRarities.sort((a, b) => b.rarityScore - a.rarityScore);

	return {
		traitRarities: enhancedTraitRarities,
		nftRarities,
		rarestNFT: nftRarities[0]?.nft,
		mostCommonNFT: nftRarities[nftRarities.length - 1]?.nft
	};
}

/**
 * Calculate emergent rarity based on trait combinations
 */
export function calculateEmergentNFTRarities(collection: GalleryCollection): any {
	// Group NFTs by trait combinations
	const combinationMap = new Map<string, GalleryNFT[]>();

	for (const nft of collection.nfts) {
		const sortedTraits = nft.metadata.traits
			.map((trait) => {
				const layer = trait.layer || (trait as any).trait_type;
				const traitValue = trait.trait || (trait as any).value;
				return `${layer}:${traitValue}`;
			})
			.sort()
			.join('|');

		if (!combinationMap.has(sortedTraits)) {
			combinationMap.set(sortedTraits, []);
		}
		combinationMap.get(sortedTraits)!.push(nft);
	}

	// Calculate emergent rarity scores
	const nftRarities: any[] = [];
	const totalNFTs = collection.nfts.length;

	for (const nft of collection.nfts) {
		const sortedTraits = nft.metadata.traits
			.map((trait) => {
				const layer = trait.layer || (trait as any).trait_type;
				const traitValue = trait.trait || (trait as any).value;
				return `${layer}:${traitValue}`;
			})
			.sort()
			.join('|');

		const combinationCount = combinationMap.get(sortedTraits)!.length;
		const combinationPercentage = (combinationCount / totalNFTs) * 100;
		const emergentRarityScore = 100 / combinationPercentage;

		nftRarities.push({
			nft,
			rarityScore: emergentRarityScore,
			traitRarities: [],
			emergentRarity: true,
			combinationUniqueness:
				combinationPercentage < 5
					? 'very rare'
					: combinationPercentage < 10
						? 'rare'
						: combinationPercentage < 25
							? 'uncommon'
							: 'common'
		});
	}

	// Sort by rarity score (descending)
	nftRarities.sort((a, b) => b.rarityScore - a.rarityScore);

	return {
		traitRarities: new Map(),
		nftRarities,
		rarestNFT: nftRarities[0]?.nft,
		mostCommonNFT: nftRarities[nftRarities.length - 1]?.nft
	};
}

/**
 * Get rarity tier based on score
 */
function getRarityTier(score: number, tiers: RarityTier[]): number {
	for (let i = 0; i < tiers.length; i++) {
		if (score >= tiers[i].minScore && score <= tiers[i].maxScore) {
			return i + 1; // 1-based indexing
		}
	}
	return tiers.length;
}

/**
 * Get influence level based on rarity score
 */
function getInfluenceLevel(score: number): 'high' | 'medium' | 'low' {
	if (score >= 10) return 'high';
	if (score >= 3) return 'medium';
	return 'low';
}

/**
 * Classify strategic value based on rarity and percentage
 */
function classifyStrategicValue(
	score: number,
	percentage: number
): 'strategic' | 'balanced' | 'filler' {
	if (score >= 15 || percentage <= 2) return 'strategic';
	if (score >= 5 || percentage <= 10) return 'balanced';
	return 'filler';
}

/**
 * Calculate strategic combinations for a layer
 */
export function calculateStrategicCombinations(
	collection: GalleryCollection,
	targetLayer: string
): StrategicCombination {
	const layerTraits = new Map<string, number>();

	// Count traits in target layer
	for (const nft of collection.nfts) {
		for (const trait of nft.metadata.traits) {
			const layer = trait.layer || (trait as any).trait_type;
			const traitValue = trait.trait || (trait as any).value;

			if (layer === targetLayer) {
				layerTraits.set(traitValue, (layerTraits.get(traitValue) || 0) + 1);
			}
		}
	}

	const totalNFTs = collection.nfts.length;
	let strategic = 0;
	let balanced = 0;
	let filler = 0;

	for (const [trait, count] of layerTraits) {
		const percentage = (count / totalNFTs) * 100;
		const score = 100 / percentage;
		const classification = classifyStrategicValue(score, percentage);

		switch (classification) {
			case 'strategic':
				strategic++;
				break;
			case 'balanced':
				balanced++;
				break;
			case 'filler':
				filler++;
				break;
		}
	}

	return { strategic, balanced, filler };
}

/**
 * Update a collection with calculated rarity data
 */
export function updateCollectionWithRarity(
	collection: GalleryCollection,
	method: RarityMethod = RarityMethod.TRAIT_RARITY
): GalleryCollection {
	const stats = calculateNFTRarities(collection, method);
	const updatedNFTs = stats.nftRarities.map((data, index) => ({
		...data.nft,
		rarityScore: data.rarityScore,
		rarityRank: index + 1
	}));

	return {
		...collection,
		nfts: updatedNFTs
	};
}

/**
 * Get trait statistics for a collection
 */
export function getTraitStatistics(collection: GalleryCollection): Array<{
	layer: string;
	trait: string;
	count: number;
	percentage: number;
	rarityScore: number;
}> {
	const traitRarities = calculateTraitRarities(collection);
	return Array.from(traitRarities.values())
		.sort((a, b) => b.rarityScore - a.rarityScore)
		.slice(0, 20); // Top 20 rarest traits
}

/**
 * Find NFTs with specific trait combinations
 */
export function findNFTsWithTraits(
	collection: GalleryCollection,
	requiredTraits: Array<{ layer: string; trait: string }>
): GalleryNFT[] {
	return collection.nfts.filter((nft) => {
		return requiredTraits.every((required) => {
			return nft.metadata.traits.some((trait) => {
				const layer = trait.layer || (trait as any).trait_type;
				const traitValue = trait.trait || (trait as any).value;
				return layer === required.layer && traitValue === required.trait;
			});
		});
	});
}

/**
 * Calculate similarity between two NFTs based on traits
 */
export function calculateNFTSimilarity(nft1: GalleryNFT, nft2: GalleryNFT): number {
	const traits1 = new Set(
		nft1.metadata.traits.map((t) => {
			const layer = t.layer || (t as any).trait_type;
			const traitValue = t.trait || (t as any).value;
			return `${layer}:${traitValue}`;
		})
	);
	const traits2 = new Set(
		nft2.metadata.traits.map((t) => {
			const layer = t.layer || (t as any).trait_type;
			const traitValue = t.trait || (t as any).value;
			return `${layer}:${traitValue}`;
		})
	);

	const intersection = new Set([...traits1].filter((trait) => traits2.has(trait)));
	const union = new Set([...traits1, ...traits2]);

	return intersection.size / union.size; // Jaccard similarity
}

/**
 * Find similar NFTs to a given NFT
 */
export function findSimilarNFTs(
	collection: GalleryCollection,
	targetNFT: GalleryNFT,
	limit: number = 5
): Array<{ nft: GalleryNFT; similarity: number }> {
	const similarities = collection.nfts
		.filter((nft) => nft.id !== targetNFT.id)
		.map((nft) => ({
			nft,
			similarity: calculateNFTSimilarity(targetNFT, nft)
		}))
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, limit);

	return similarities;
}

/**
 * Export rarity data for external analysis
 */
export function exportRarityData(collection: GalleryCollection): {
	collection: string;
	method: string;
	generatedAt: string;
	traits: any[];
	nfts: any[];
} {
	const stats = calculateNFTRarities(collection);

	return {
		collection: collection.name,
		method: RarityMethod.TRAIT_RARITY,
		generatedAt: new Date().toISOString(),
		traits: Array.from(stats.traitRarities.values()).map((trait) => ({
			layer: trait.layer,
			trait: trait.trait,
			count: trait.count,
			percentage: trait.percentage,
			rarityScore: trait.rarityScore
		})),
		nfts: stats.nftRarities.map((data, index) => ({
			id: data.nft.id,
			name: data.nft.name,
			rarityScore: data.rarityScore,
			rarityRank: index + 1,
			traits: data.traitRarities.map((trait: TraitRarity) => ({
				layer: trait.layer,
				trait: trait.trait,
				rarityScore: trait.rarityScore
			}))
		}))
	};
}
