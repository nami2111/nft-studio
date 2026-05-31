/**
 * MemoryPressureMonitor — detects memory pressure and triggers cleanup callbacks.
 *
 * Listens for the browser's `memorypressure` event (where supported) and runs
 * a periodic poll. Calls registered cleanup callbacks at varying intensity:
 *   - 'aggressive' when usage > 100MB
 *   - 'moderate'   when usage > 50MB
 *   - 'light'      when periodic poll finds usage > 20MB
 *
 * Owners pass a `getCurrentUsageBytes` probe so the monitor stays decoupled
 * from cache internals.
 */

export type CleanupIntensity = 'light' | 'moderate' | 'aggressive';

export interface MemoryPressureMonitorOptions {
	/** Returns current memory usage in bytes (e.g. sum of cache sizes). */
	getCurrentUsageBytes: () => number;
	/** Called when pressure thresholds are crossed. */
	onCleanup: (intensity: CleanupIntensity) => void;
	/** Override poll interval (default: 5 minutes). */
	pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const AGGRESSIVE_THRESHOLD_BYTES = 100 * 1024 * 1024;
const MODERATE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const LIGHT_THRESHOLD_BYTES = 20 * 1024 * 1024;

export class MemoryPressureMonitor {
	private readonly opts: MemoryPressureMonitorOptions;
	private listener?: (event: Event) => void;
	private pollHandle: number | null = null;
	private started = false;

	constructor(opts: MemoryPressureMonitorOptions) {
		this.opts = opts;
	}

	start(): void {
		if (this.started || typeof window === 'undefined') return;
		this.started = true;

		this.listener = () => {
			console.warn('Memory pressure detected, performing emergency cleanup');
			this.handlePressureEvent();
		};
		window.addEventListener('memorypressure', this.listener);

		const interval = this.opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
		this.pollHandle = window.setInterval(() => this.handlePeriodicPoll(), interval);
	}

	stop(): void {
		if (!this.started) return;
		this.started = false;

		if (this.listener && typeof window !== 'undefined') {
			window.removeEventListener('memorypressure', this.listener);
			this.listener = undefined;
		}
		if (this.pollHandle !== null) {
			clearInterval(this.pollHandle);
			this.pollHandle = null;
		}
	}

	/** Force an immediate pressure check. Useful for tests and manual triggers. */
	checkNow(): void {
		this.handlePressureEvent();
	}

	private handlePressureEvent(): void {
		const usage = this.opts.getCurrentUsageBytes();
		if (usage > AGGRESSIVE_THRESHOLD_BYTES) {
			this.opts.onCleanup('aggressive');
		} else if (usage > MODERATE_THRESHOLD_BYTES) {
			this.opts.onCleanup('moderate');
		}
	}

	private handlePeriodicPoll(): void {
		const usage = this.opts.getCurrentUsageBytes();
		if (usage > LIGHT_THRESHOLD_BYTES) {
			this.opts.onCleanup('light');
		}
	}
}
