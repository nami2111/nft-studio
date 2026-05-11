/**
 * Dedicated Web Worker for CSP solving.
 * Offloads the AC-3 constraint solver from the main thread.
 */

import type { TransferrableLayer } from '$lib/types/worker-messages';
import { CSPSolver } from './csp-solver';

interface SolverLayer {
	id: string;
	name: string;
	order: number;
	isOptional?: boolean;
	traits: SolverTrait[];
}

interface SolverTrait {
	id: string;
	name: string;
	rarityWeight: number;
	type?: string;
	rulerRules?: Array<{
		layerId: string;
		forbiddenTraitIds: string[];
		allowedTraitIds: string[];
	}>;
}

interface SolveRequest {
	type: 'solve';
	payload: {
		layers: SolverLayer[];
		collectionSize: number;
		strictPairConfig?: {
			enabled: boolean;
			layerCombinations: Array<{
				id: string;
				layerIds: string[];
				active: boolean;
			}>;
		};
	};
}

let isCancelled = false;

// Module-level state so the cancel handler can access the active solve context
let activeSolutions: {
	index: number;
	traits: { layerId: string; traitId: string; traitName: string }[];
}[] = [];
let activeSolvedCount = 0;
let activeCollectionSize = 0;
const CHUNK_SIZE = 100;

/**
 * Flush any buffered solutions to the client before cancellation,
 * so partial results are not lost.
 */
function flushPartialSolutions(): void {
	if (activeSolutions.length > 0) {
		(self as unknown as Worker).postMessage({
			type: 'chunk',
			payload: { solutions: activeSolutions.splice(0) }
		});
	}
}

self.addEventListener('message', (e: MessageEvent<SolveRequest | { type: 'cancel' }>) => {
	const message = e.data;

	if (message.type === 'cancel') {
		isCancelled = true;
		// Flush accumulated solutions before returning, so the client
		// can recover partial results instead of losing everything.
		flushPartialSolutions();
		self.postMessage({
			type: 'cancelled',
			payload: {
				generatedCount: activeSolvedCount,
				totalCount: activeCollectionSize
			}
		});
		return;
	}

	if (message.type !== 'solve') return;

	const { layers, collectionSize, strictPairConfig } = message.payload;
	isCancelled = false;

	const usedCombinations = new Map<string, Set<bigint | string>>();
	const solver = new CSPSolver(
		layers as unknown as TransferrableLayer[],
		usedCombinations,
		strictPairConfig
	);

	activeCollectionSize = collectionSize;
	activeSolvedCount = 0;
	activeSolutions = [];

	try {
		for (let i = 0; i < collectionSize; i++) {
			if (isCancelled) {
				flushPartialSolutions();
				self.postMessage({
					type: 'cancelled',
					payload: {
						generatedCount: activeSolvedCount,
						totalCount: collectionSize
					}
				});
				return;
			}

			const solutionMap = solver.solve();
			if (!solutionMap) {
				self.postMessage({
					type: 'error',
					payload: {
						message: `Exhausted all possible valid unique combinations at item ${i + 1}.`
					}
				});
				return;
			}

			solver.markCombinationAsUsed();
			activeSolvedCount++;

			const sortedTraits = Array.from(solutionMap.entries())
				.map(([layerId, trait]) => {
					const layer = layers.find((l) => l.id === layerId);
					return {
						layerId,
						traitId: trait.id,
						traitName: trait.name,
						order: layer?.order || 0
					};
				})
				.sort((a, b) => a.order - b.order)
				.map(({ layerId, traitId, traitName }) => ({ layerId, traitId, traitName }));

			activeSolutions.push({
				index: i,
				traits: sortedTraits
			});

			// Stream progress in chunks
			if (activeSolutions.length >= CHUNK_SIZE) {
				self.postMessage({
					type: 'progress',
					payload: {
						generatedCount: i + 1,
						totalCount: collectionSize
					}
				});
				// Send chunk of solutions
				self.postMessage({
					type: 'chunk',
					payload: { solutions: activeSolutions.splice(0, CHUNK_SIZE) }
				});
			}
		}

		// Send any remaining solutions
		if (activeSolutions.length > 0) {
			self.postMessage({
				type: 'chunk',
				payload: { solutions: activeSolutions.splice(0) }
			});
		}

		self.postMessage({
			type: 'complete',
			payload: { totalSolved: collectionSize }
		});
	} catch (error) {
		self.postMessage({
			type: 'error',
			payload: {
				message: error instanceof Error ? error.message : 'Solver worker error'
			}
		});
	} finally {
		activeSolutions = [];
		activeSolvedCount = 0;
	}
});
