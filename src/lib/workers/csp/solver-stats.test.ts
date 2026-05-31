import { describe, expect, it } from 'vite-plus/test';
import { SolverStats } from './solver-stats';

describe('SolverStats', () => {
	it('initializes counters at zero', () => {
		const stats = new SolverStats();
		const snap = stats.snapshot();

		expect(snap.constraintChecks).toBe(0);
		expect(snap.backtracks).toBe(0);
		expect(snap.ac3Iterations).toBe(0);
		expect(snap.rulerViolations).toBe(0);
	});

	it('start resets counters and begins timing', () => {
		const stats = new SolverStats();
		stats.constraintChecks = 5;
		stats.backtracks = 3;
		stats.start();

		expect(stats.constraintChecks).toBe(0);
		expect(stats.backtracks).toBe(0);
	});

	it('stop captures duration', async () => {
		const stats = new SolverStats();
		stats.start();
		await new Promise((resolve) => setTimeout(resolve, 5));
		stats.stop();

		const snap = stats.snapshot();
		expect(snap.durationMs).toBeGreaterThanOrEqual(0);
	});

	it('snapshot returns a copy not a reference', () => {
		const stats = new SolverStats();
		stats.start();
		stats.constraintChecks = 10;

		const snap = stats.snapshot();
		stats.constraintChecks = 20;

		expect(snap.constraintChecks).toBe(10);
	});

	it('counters increment correctly', () => {
		const stats = new SolverStats();
		stats.start();

		stats.constraintChecks++;
		stats.constraintChecks++;
		stats.backtracks++;
		stats.rulerViolations += 3;

		const snap = stats.snapshot();
		expect(snap.constraintChecks).toBe(2);
		expect(snap.backtracks).toBe(1);
		expect(snap.rulerViolations).toBe(3);
	});
});
