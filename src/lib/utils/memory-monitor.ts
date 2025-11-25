/**
 * Memory monitoring utilities for large collection processing
 */

export interface MemoryUsage {
	used: number;
	total: number;
	percentage: number;
	timestamp: number;
}

export interface MemoryThresholds {
	warning: number; // 80%
	critical: number; // 90%
}

export class MemoryMonitor {
	private static readonly DEFAULT_THRESHOLDS: MemoryThresholds = {
		warning: 0.8,
		critical: 0.9
	};

	private static readonly SAMPLE_INTERVAL = 5000; // 5 seconds
	private static monitoring = false;
	private static samples: MemoryUsage[] = [];
	private static listeners: ((usage: MemoryUsage) => void)[] = [];

	/**
	 * Start monitoring memory usage
	 */
	static start(thresholds: Partial<MemoryThresholds> = {}): void {
		if (this.monitoring) return;

		const actualThresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
		this.monitoring = true;

		const monitor = () => {
			if (!this.monitoring) return;

			const usage = this.getCurrentUsage();
			this.samples.push(usage);

			// Keep only last 100 samples
			if (this.samples.length > 100) {
				this.samples.shift();
			}

			// Notify listeners
			this.listeners.forEach((listener) => listener(usage));

			// Check thresholds
			if (usage.percentage > actualThresholds.critical) {
				console.warn('🚨 Critical memory usage detected:', usage);
				this.triggerGarbageCollection();
			} else if (usage.percentage > actualThresholds.warning) {
				console.warn('⚠️ Memory usage warning:', usage);
			}

			setTimeout(monitor, this.SAMPLE_INTERVAL);
		};

		monitor();
	}

	/**
	 * Stop monitoring memory usage
	 */
	static stop(): void {
		this.monitoring = false;
		this.samples = [];
		this.listeners = [];
	}

	/**
	 * Get current memory usage
	 */
	static getCurrentUsage(): MemoryUsage {
		let used = 0;
		let total = 100;

		// Try to get actual memory usage from performance API
		if ('memory' in performance) {
			const memory = (performance as any).memory;
			used = memory.usedJSHeapSize;
			total = memory.jsHeapSizeLimit;
		} else if (typeof window !== 'undefined' && 'webkitPerformance' in window) {
			// Safari fallback
			const memory = (window as any).webkitPerformance.memory;
			if (memory) {
				used = memory.usedJSHeapSize;
				total = memory.jsHeapSizeLimit;
			}
		}

		return {
			used,
			total,
			percentage: used / total,
			timestamp: Date.now()
		};
	}

	/**
	 * Get memory usage history
	 */
	static getHistory(): MemoryUsage[] {
		return [...this.samples];
	}

	/**
	 * Add listener for memory usage changes
	 */
	static addListener(listener: (usage: MemoryUsage) => void): void {
		this.listeners.push(listener);
	}

	/**
	 * Remove listener
	 */
	static removeListener(listener: (usage: MemoryUsage) => void): void {
		const index = this.listeners.indexOf(listener);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	}

	/**
	 * Force garbage collection if available
	 */
	static triggerGarbageCollection(): void {
		if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
			try {
				(globalThis as any).gc();
				console.log('🧹 Forced garbage collection');
			} catch (error) {
				console.warn('Garbage collection not available or failed:', error);
			}
		}
	}

	/**
	 * Check if memory usage is safe for large operations
	 */
	static isSafeForLargeOperation(itemCount: number): boolean {
		const usage = this.getCurrentUsage();

		// Estimate memory needed (rough approximation)
		const estimatedMB = itemCount * 0.1; // ~100KB per item

		// Check if we have enough headroom (keep 30% free)
		const availableMB = (usage.total - usage.used) / (1024 * 1024);

		return availableMB > estimatedMB * 1.5; // 50% safety margin
	}

	/**
	 * Get memory pressure level
	 */
	static getPressureLevel(): 'low' | 'medium' | 'high' {
		const usage = this.getCurrentUsage();
		const percentage = usage.percentage;

		if (percentage < 0.6) return 'low';
		if (percentage < 0.8) return 'medium';
		return 'high';
	}
}
