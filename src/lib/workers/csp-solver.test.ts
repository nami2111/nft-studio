/**
 * Test suite for CSPSolver.
 *
 * @module csp-solver.test
 */

import { describe, expect, it } from "vite-plus/test";
import type {
	TransferrableLayer,
	TransferrableTrait,
} from "$lib/types/worker-messages";
import { CSPSolver } from "./csp-solver";

function makeTrait(
	id: string,
	name: string,
	overrides?: Partial<TransferrableTrait>,
): TransferrableTrait {
	return {
		id: id as never,
		name,
		imageData: new ArrayBuffer(8),
		rarityWeight: 1,
		...overrides,
	};
}

function makeLayer(
	id: string,
	name: string,
	traits: TransferrableTrait[],
	order = 0,
	isOptional = false,
): TransferrableLayer {
	return {
		id: id as never,
		name,
		order,
		isOptional,
		traits,
	};
}

function makeStrictPairConfig(
	layerIds: string[],
): NonNullable<ConstructorParameters<typeof CSPSolver>[2]> {
	return {
		enabled: true,
		layerCombinations: [
			{
				id: "__global__",
				layerIds,
				active: true,
			},
		],
	};
}

describe("CSPSolver", () => {
	it("solves a single layer with one trait", () => {
		const layers = [makeLayer("L1", "Background", [makeTrait("T1", "Blue")])];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1"]),
		);
		const result = solver.solve();

		expect(result).not.toBeNull();
		expect(result!.size).toBe(1);
		expect(result!.get("L1")!.name).toBe("Blue");
	});

	it("solves a single layer with multiple traits", () => {
		const layers = [
			makeLayer("L1", "Background", [
				makeTrait("T1", "Blue"),
				makeTrait("T2", "Red"),
				makeTrait("T3", "Green"),
			]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1"]),
		);
		const result = solver.solve();

		expect(result).not.toBeNull();
		expect(result!.get("L1")).toBeDefined();
	});

	it("solves two layers with no constraints", () => {
		const layers = [
			makeLayer("L1", "Background", [
				makeTrait("T1", "Blue"),
				makeTrait("T2", "Red"),
			]),
			makeLayer("L2", "Eyes", [
				makeTrait("T3", "Green"),
				makeTrait("T4", "Brown"),
			]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);
		const result = solver.solve();

		expect(result).not.toBeNull();
		expect(result!.size).toBe(2);
		expect(result!.get("L1")).toBeDefined();
		expect(result!.get("L2")).toBeDefined();
	});

	it("returns null when there is no valid combination", () => {
		// Single trait for each layer, but usedCombinations already has it
		const layers = [makeLayer("L1", "BG", [makeTrait("T1", "Blue")])];
		const usedCombinations = new Map<string, Set<bigint>>();
		usedCombinations.set("__global__", new Set<bigint>());

		const solver = new CSPSolver(
			layers,
			usedCombinations,
			makeStrictPairConfig(["L1"]),
		);

		// First solve should work
		const r1 = solver.solve();
		expect(r1).not.toBeNull();
		solver.markCombinationAsUsed();

		// Second solve should fail (only combination is used)
		const r2 = solver.solve();
		expect(r2).toBeNull();
	});

	it("populates performance stats after solving", () => {
		const layers = [
			makeLayer("L1", "BG", [makeTrait("T1", "Blue"), makeTrait("T2", "Red")]),
			makeLayer("L2", "Eyes", [makeTrait("T3", "Green")]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);

		// Before solving, stats should be zero
		const initialStats = solver.getPerformanceStats();
		expect(initialStats.constraintChecks).toBe(0);

		solver.solve();

		const finalStats = solver.getPerformanceStats();
		// After solving, some stats should be populated
		expect(
			finalStats.constraintChecks +
				finalStats.backtracks +
				finalStats.ac3Iterations,
		).toBeGreaterThan(0);
	});

	it("handles empty layers gracefully", () => {
		const solver = new CSPSolver([], new Map());
		const result = solver.solve();
		// No layers means no traits to assign — solution is empty
		expect(result).not.toBeNull();
		expect(result!.size).toBe(0);
	});

	it("respects ruler forbidden constraints", () => {
		const layers = [
			makeLayer("L1", "Background", [
				{
					...makeTrait("T1", "Blue"),
					type: "ruler" as never,
					rulerRules: [
						{
							layerId: "L2" as never,
							forbiddenTraitIds: ["T3" as never],
							allowedTraitIds: [],
						},
					],
				},
				makeTrait("T2", "Red"),
			]),
			makeLayer("L2", "Eyes", [
				makeTrait("T3", "Green"),
				makeTrait("T4", "Brown"),
			]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);

		// Run multiple times to see if Blue+Green combo is ever produced
		let blueWithGreen = false;
		for (let i = 0; i < 50; i++) {
			const result = solver.solve();
			if (!result) break;
			const bg = result.get("L1")!;
			const eyes = result.get("L2")!;
			if (bg.name === "Blue" && eyes.name === "Green") {
				blueWithGreen = true;
				break;
			}
			solver.markCombinationAsUsed();
		}

		expect(blueWithGreen).toBe(false);
	});

	it("respects ruler allowed constraints", () => {
		const layers = [
			makeLayer("L1", "Background", [
				{
					...makeTrait("T1", "Blue"),
					type: "ruler" as never,
					rulerRules: [
						{
							layerId: "L2" as never,
							forbiddenTraitIds: [],
							allowedTraitIds: ["T4" as never],
						},
					],
				},
			]),
			makeLayer("L2", "Eyes", [
				makeTrait("T3", "Green"),
				makeTrait("T4", "Brown"),
			]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);

		// Every Blue assignment should only pair with Brown (T4)
		let blueWithGreen = false;
		for (let i = 0; i < 20; i++) {
			const result = solver.solve();
			if (!result) break;
			const bg = result.get("L1")!;
			const eyes = result.get("L2")!;
			if (bg.name === "Blue" && eyes.name === "Green") {
				blueWithGreen = true;
				break;
			}
			solver.markCombinationAsUsed();
		}

		expect(blueWithGreen).toBe(false);
	});

	it("generates unique combinations across solve calls", () => {
		const layers = [
			makeLayer("L1", "BG", [makeTrait("T1", "Blue"), makeTrait("T2", "Red")]),
			makeLayer("L2", "Eyes", [
				makeTrait("T3", "Green"),
				makeTrait("T4", "Brown"),
			]),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);

		const seen = new Set<string>();
		for (let i = 0; i < 4; i++) {
			const result = solver.solve();
			if (!result) break;
			const key = `${result.get("L1")!.name}:${result.get("L2")!.name}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			solver.markCombinationAsUsed();
		}

		// With 2x2 traits, we should see multiple unique combos
		expect(seen.size).toBeGreaterThanOrEqual(2);
	});

	it("handles optional layers", () => {
		const layers = [
			makeLayer("L1", "BG", [makeTrait("T1", "Blue")]),
			makeLayer("L2", "Accessory", [makeTrait("T2", "Hat")], 1, true),
		];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1", "L2"]),
		);
		const result = solver.solve();

		// Required layer always present
		expect(result).not.toBeNull();
		expect(result!.get("L1")).toBeDefined();
		// Optional layer may or may not be present — both are valid
	});

	it("clearCaches does not throw", () => {
		const layers = [makeLayer("L1", "BG", [makeTrait("T1", "Blue")])];
		const solver = new CSPSolver(
			layers,
			new Map(),
			makeStrictPairConfig(["L1"]),
		);
		solver.solve();
		expect(() => solver.clearCaches()).not.toThrow();
	});
});
