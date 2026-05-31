/**
 * Performance metrics for the CSP solver.
 *
 * Tracks counters for AC-3 propagation, backtracking search, and cache behavior.
 * Exposed via {@link CSPSolver.getStats} so callers can monitor solver health
 * without reading internal state.
 */
export interface SolverStatsSnapshot {
	cacheHits: number;
	constraintChecks: number;
	backtracks: number;
	ac3Iterations: number;
	earlyTerminations: number;
	constraintCacheHits: number;
	rulerViolations: number;
	durationMs: number;
}

export class SolverStats {
	cacheHits = 0;
	constraintChecks = 0;
	backtracks = 0;
	ac3Iterations = 0;
	earlyTerminations = 0;
	constraintCacheHits = 0;
	rulerViolations = 0;
	private startedAt = 0;
	private durationMs = 0;

	start(): void {
		this.cacheHits = 0;
		this.constraintChecks = 0;
		this.backtracks = 0;
		this.ac3Iterations = 0;
		this.earlyTerminations = 0;
		this.constraintCacheHits = 0;
		this.rulerViolations = 0;
		this.startedAt = Date.now();
		this.durationMs = 0;
	}

	stop(): void {
		this.durationMs = Date.now() - this.startedAt;
	}

	snapshot(): SolverStatsSnapshot {
		return {
			cacheHits: this.cacheHits,
			constraintChecks: this.constraintChecks,
			backtracks: this.backtracks,
			ac3Iterations: this.ac3Iterations,
			earlyTerminations: this.earlyTerminations,
			constraintCacheHits: this.constraintCacheHits,
			rulerViolations: this.rulerViolations,
			durationMs: this.durationMs || Date.now() - this.startedAt
		};
	}
}
