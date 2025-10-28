/**
 * Rarity Calculator - Calculate trait rarity and NFT rarity scores
 * Implements multiple rarity calculation methods
 */

import type { GalleryNFT, GalleryCollection } from '$lib/types/gallery';

export interface TraitRarity {
	layer: string;
	trait: string;
	count: number;
	percentage: number;
	rarityScore: number;
}

export interface NFTRarityData {
	nft: GalleryNFT;
	rarityScore: number;
	traitRarities: TraitRarity[];
}

export interface CollectionRarityStats {
	traitRarities: Map<string, TraitRarity>;
	nftRarities: NFTRarityData[];
	rarestNFT: GalleryNFT;
	mostCommonNFT: GalleryNFT;
}

/**
 * Rarity calculation methods
 */
export enum RarityMethod {
	TRAIT_RARITY = 'trait_rarity', // Sum of individual trait rarities
	AVERAGE_TRAIT_RARITY = 'average_trait_rarity', // Average of trait rarities
	WEIGHTED_TRAIT_RARITY = 'weighted_trait_rarity', // Weighted by layer importance
	STANDARD_DEVIATION = 'standard_deviation' // Based on statistical deviation
}

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
 * Calculate rarity scores for all NFTs in a collection
 */
export function calculateNFTRarities(
	collection: GalleryCollection,
	method: RarityMethod = RarityMethod.TRAIT_RARITY
): CollectionRarityStats {
	const traitRarities = calculateTraitRarities(collection);
	const nftRarities: NFTRarityData[] = [];

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
			traits: data.traitRarities.map((trait) => ({
				layer: trait.layer,
				trait: trait.trait,
				rarityScore: trait.rarityScore
			}))
		}))
	};
}
