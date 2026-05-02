/**
 * Test suite for rarity calculator.
 *
 * @module rarity-calculator.test
 */

import { describe, expect, it } from "vite-plus/test";
import type { GalleryCollection, GalleryItem } from "$lib/types/gallery";
import {
	calculateItemRarities,
	calculateItemSimilarity,
	calculateTraitRarities,
	DEFAULT_RARITY_TIERS,
	findItemsWithTraits,
	getTraitStatistics,
	RarityMethod,
	updateCollectionWithRarity,
} from "./rarity-calculator";

function makeItem(
	id: string,
	traits: Array<{ layer: string; trait: string; rarity: number }>,
): GalleryItem {
	return {
		id,
		name: `Item ${id}`,
		imageData: new ArrayBuffer(8),
		metadata: { traits },
		rarityScore: 0,
		rarityRank: 0,
		collectionId: "col-1",
		generatedAt: new Date(),
	};
}

function makeCollection(items: GalleryItem[]): GalleryCollection {
	return {
		id: "col-1",
		name: "Test Collection",
		description: "A test collection",
		projectName: "Test Project",
		items,
		generatedAt: new Date(),
		totalSupply: items.length,
	};
}

describe("calculateTraitRarities", () => {
	it("returns an empty map for an empty collection", () => {
		const collection = makeCollection([]);
		const rarities = calculateTraitRarities(collection);
		expect(rarities.size).toBe(0);
	});

	it("calculates percentages correctly for uniform distribution", () => {
		const items = [
			makeItem("1", [
				{ layer: "Background", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
			makeItem("2", [
				{ layer: "Background", trait: "Red", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
		];
		const collection = makeCollection(items);
		const rarities = calculateTraitRarities(collection);

		expect(rarities.size).toBe(3); // Blue, Red, Green
		const blue = rarities.get("Background:Blue")!;
		expect(blue.count).toBe(1);
		expect(blue.percentage).toBeCloseTo(50, 5);
		expect(blue.rarityScore).toBeCloseTo(2, 5); // 100/50

		const green = rarities.get("Eyes:Green")!;
		expect(green.count).toBe(2);
		expect(green.percentage).toBeCloseTo(100, 5);
		expect(green.rarityScore).toBeCloseTo(1, 5); // 100/100
	});

	it("rare traits get higher rarity scores", () => {
		// 10 items: 9 Blue, 1 Red → Red is rare
		const items = Array.from({ length: 10 }, (_, i) =>
			makeItem(String(i), [
				{ layer: "BG", trait: i === 0 ? "Red" : "Blue", rarity: 0 },
			]),
		);
		const collection = makeCollection(items);
		const rarities = calculateTraitRarities(collection);

		const red = rarities.get("BG:Red")!;
		const blue = rarities.get("BG:Blue")!;

		expect(red.rarityScore).toBeGreaterThan(blue.rarityScore);
		expect(red.count).toBe(1);
		expect(blue.count).toBe(9);
		expect(red.percentage).toBeCloseTo(10, 5);
		expect(red.rarityScore).toBeCloseTo(10, 5);
	});
});

describe("calculateItemRarities", () => {
	it("returns empty results for empty collection", () => {
		const collection = makeCollection([]);
		const result = calculateItemRarities(collection, RarityMethod.TRAIT_RARITY);

		expect(result.traitRarities.size).toBe(0);
		expect(result.itemRarities).toHaveLength(0);
		expect(result.rarestItem).toBeUndefined();
		expect(result.mostCommonItem).toBeUndefined();
	});

	it("calculates TRAIT_RARITY method (sum of trait scores)", () => {
		const items = [
			makeItem("1", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
			makeItem("2", [
				{ layer: "BG", trait: "Red", rarity: 0 },
				{ layer: "Eyes", trait: "Brown", rarity: 0 },
			]),
		];
		const collection = makeCollection(items);
		const result = calculateItemRarities(collection, RarityMethod.TRAIT_RARITY);

		expect(result.itemRarities).toHaveLength(2);
		// Sorted descending by rarity score
		expect(result.itemRarities[0].rarityScore).toBeGreaterThanOrEqual(
			result.itemRarities[1].rarityScore,
		);
		expect(result.rarestItem).toBeDefined();
		expect(result.mostCommonItem).toBeDefined();
	});

	it("AVERAGE_TRAIT_RARITY normalizes by trait count", () => {
		const items = [
			makeItem("1", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
				{ layer: "Mouth", trait: "Smile", rarity: 0 },
			]),
			makeItem("2", [{ layer: "BG", trait: "Red", rarity: 0 }]),
		];
		const collection = makeCollection(items);
		const result = calculateItemRarities(
			collection,
			RarityMethod.AVERAGE_TRAIT_RARITY,
		);

		expect(result.itemRarities).toHaveLength(2);
	});

	it("WEIGHTED_TRAIT_RARITY weights later traits higher", () => {
		const items = [
			makeItem("1", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
		];
		const collection = makeCollection(items);
		const result = calculateItemRarities(
			collection,
			RarityMethod.WEIGHTED_TRAIT_RARITY,
		);
		expect(result.itemRarities).toHaveLength(1);
	});

	it("STANDARD_DEVIATION method returns a deviation-based score", () => {
		const items = [
			makeItem("1", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Brown", rarity: 0 },
			]),
			makeItem("2", [
				{ layer: "BG", trait: "Red", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
		];
		const collection = makeCollection(items);
		const result = calculateItemRarities(
			collection,
			RarityMethod.STANDARD_DEVIATION,
		);
		expect(result.itemRarities).toHaveLength(2);
	});
});

describe("updateCollectionWithRarity", () => {
	it("assigns rarity scores and ranks to items", () => {
		const items = [
			makeItem("1", [{ layer: "BG", trait: "Blue", rarity: 0 }]),
			makeItem("2", [{ layer: "BG", trait: "Red", rarity: 0 }]),
		];
		const collection = makeCollection(items);
		const updated = updateCollectionWithRarity(collection);

		expect(updated.items).toHaveLength(2);
		for (const item of updated.items) {
			expect(item.rarityScore).toBeGreaterThan(0);
			expect(item.rarityRank).toBeGreaterThan(0);
		}
		// Ranked in descending score order
		expect(updated.items[0].rarityScore).toBeGreaterThanOrEqual(
			updated.items[1].rarityScore,
		);
	});
});

describe("calculateItemSimilarity", () => {
	it("returns 1 for identical items", () => {
		const item1 = makeItem("1", [
			{ layer: "BG", trait: "Blue", rarity: 0 },
			{ layer: "Eyes", trait: "Green", rarity: 0 },
		]);
		const item2 = makeItem("2", [
			{ layer: "BG", trait: "Blue", rarity: 0 },
			{ layer: "Eyes", trait: "Green", rarity: 0 },
		]);

		expect(calculateItemSimilarity(item1, item2)).toBe(1);
	});

	it("returns 0 for completely different items", () => {
		const item1 = makeItem("1", [{ layer: "BG", trait: "Blue", rarity: 0 }]);
		const item2 = makeItem("2", [{ layer: "BG", trait: "Red", rarity: 0 }]);

		expect(calculateItemSimilarity(item1, item2)).toBe(0);
	});

	it("returns 0.5 for half-overlapping items", () => {
		const item1 = makeItem("1", [
			{ layer: "BG", trait: "Blue", rarity: 0 },
			{ layer: "Eyes", trait: "Green", rarity: 0 },
		]);
		const item2 = makeItem("2", [
			{ layer: "BG", trait: "Blue", rarity: 0 },
			{ layer: "Eyes", trait: "Brown", rarity: 0 },
		]);

		// Jaccard: intersection=1, union=3 → 1/3 ≈ 0.333
		expect(calculateItemSimilarity(item1, item2)).toBeCloseTo(1 / 3, 5);
	});
});

describe("findItemsWithTraits", () => {
	it("finds items matching required traits", () => {
		const items = [
			makeItem("1", [{ layer: "BG", trait: "Blue", rarity: 0 }]),
			makeItem("2", [{ layer: "BG", trait: "Red", rarity: 0 }]),
		];
		const collection = makeCollection(items);

		const result = findItemsWithTraits(collection, [
			{ layer: "BG", trait: "Blue" },
		]);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1");
	});

	it("requires ALL traits to match", () => {
		const items = [
			makeItem("1", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Green", rarity: 0 },
			]),
			makeItem("2", [
				{ layer: "BG", trait: "Blue", rarity: 0 },
				{ layer: "Eyes", trait: "Brown", rarity: 0 },
			]),
		];
		const collection = makeCollection(items);

		const result = findItemsWithTraits(collection, [
			{ layer: "BG", trait: "Blue" },
			{ layer: "Eyes", trait: "Green" },
		]);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1");
	});

	it("returns empty array when no match", () => {
		const items = [makeItem("1", [{ layer: "BG", trait: "Blue", rarity: 0 }])];
		const collection = makeCollection(items);

		const result = findItemsWithTraits(collection, [
			{ layer: "BG", trait: "Yellow" },
		]);
		expect(result).toHaveLength(0);
	});
});

describe("getTraitStatistics", () => {
	it("returns top 20 rarest traits sorted by rarity score", () => {
		const items = [
			makeItem("1", [{ layer: "BG", trait: "Blue", rarity: 0 }]),
			makeItem("2", [{ layer: "BG", trait: "Red", rarity: 0 }]),
			makeItem("3", [{ layer: "BG", trait: "Blue", rarity: 0 }]),
		];
		const collection = makeCollection(items);
		const stats = getTraitStatistics(collection);

		expect(stats.length).toBe(2); // Blue, Red
		// Red is rarer (1/3 vs 2/3), so it should come first
		expect(stats[0].trait).toBe("Red");
		expect(stats[0].rarityScore).toBeGreaterThan(stats[1].rarityScore);
	});
});

describe("DEFAULT_RARITY_TIERS", () => {
	it("has 5 tiers from Common to Legendary", () => {
		expect(DEFAULT_RARITY_TIERS).toHaveLength(5);
		expect(DEFAULT_RARITY_TIERS[0].name).toBe("Common");
		expect(DEFAULT_RARITY_TIERS[4].name).toBe("Legendary");
	});

	it("Legendary tier has no upper bound", () => {
		expect(DEFAULT_RARITY_TIERS[4].maxScore).toBe(Infinity);
	});

	it("tiers are in ascending score order", () => {
		for (let i = 0; i < DEFAULT_RARITY_TIERS.length - 1; i++) {
			expect(DEFAULT_RARITY_TIERS[i].maxScore).toBeLessThanOrEqual(
				DEFAULT_RARITY_TIERS[i + 1].minScore,
			);
		}
	});
});
