import { getPerformanceConfig, type PerformanceConfig } from '$lib/config/performance.config';

export interface CacheMetrics {
	hits: number;
	misses: number;
	evictions: number;
	memoryUsage: number;
}

export interface DatabaseMetrics {
	queryCount: number;
	slowQueries: Array<{
		operation: string;
		duration: number;
		timestamp: number;
	}>;
	averageQueryTime: number;
	totalQueryTime: number;
}

export interface MemoryMetrics {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
	timestamp: number;
}

export interface PerformanceAlert {
	id: string;
	metric: string;
	value: number;
	threshold: number;
	severity: 'low' | 'medium' | 'high' | 'critical';
	timestamp: number;
	message: string;
}

interface MetricsSnapshot {
	timestamp: number;
	cache: Record<string, CacheMetrics>;
	database: DatabaseMetrics;
	memory: MemoryMetrics | null;
	alerts: PerformanceAlert[];
}

export class ProductionMonitor {
	private static instance: ProductionMonitor;
	private config: PerformanceConfig;

	// Cache metrics storage
	private cacheMetrics = new Map<string, CacheMetrics>();

	// Database metrics
	private dbMetrics: DatabaseMetrics = {
		queryCount: 0,
		slowQueries: [],
		averageQueryTime: 0,
		totalQueryTime: 0
	};

	// Memory metrics history
	private memoryHistory: MemoryMetrics[] = [];
	private maxMemoryHistory = 100;

	// Alerts
	private alerts: PerformanceAlert[] = [];
	private maxAlerts = 50;

	// Performance budgets
	private performanceBudgets = {
		maxBundleSize: 500 * 1024, // 500KB
		maxInitialLoad: 2000, // 2s
		maxMemoryUsage: 200 * 1024 * 1024, // 200MB
		maxCpuUsage: 75 // 75%
	};

	private constructor() {
		this.config = getPerformanceConfig();
		this.startMonitoring();
	}

	static getInstance(): ProductionMonitor {
		if (!ProductionMonitor.instance) {
			ProductionMonitor.instance = new ProductionMonitor();
		}
		return ProductionMonitor.instance;
	}

	/**
	 * Start continuous monitoring
	 */
	private startMonitoring(): void {
		// Memory monitoring every 5 seconds
		setInterval(() => {
			this.captureMemoryMetrics();
		}, 5000);

		// Log metrics every 30 seconds
		setInterval(() => {
			this.logMetricsSummary();
		}, 30000);

		// Cleanup old metrics every minute
		setInterval(() => {
			this.cleanupOldMetrics();
		}, 60000);
	}

	// ==========================================
	// Cache Monitoring
	// ==========================================

	/**
	 * Record cache hit
	 */
	recordCacheHit(cacheName: string): void {
		const metrics = this.getOrCreateCacheMetrics(cacheName);
		metrics.hits++;
		this.checkCacheThresholds(cacheName, metrics);
	}

	/**
	 * Record cache miss
	 */
	recordCacheMiss(cacheName: string): void {
		const metrics = this.getOrCreateCacheMetrics(cacheName);
		metrics.misses++;
		this.checkCacheThresholds(cacheName, metrics);
	}

	/**
	 * Record cache eviction
	 */
	recordCacheEviction(cacheName: string, memoryFreed: number): void {
		const metrics = this.getOrCreateCacheMetrics(cacheName);
		metrics.evictions++;
		metrics.memoryUsage = Math.max(0, metrics.memoryUsage - memoryFreed);
	}

	/**
	 * Update cache memory usage
	 */
	updateCacheMemoryUsage(cacheName: string, memoryUsage: number): void {
		const metrics = this.getOrCreateCacheMetrics(cacheName);
		metrics.memoryUsage = memoryUsage;
		this.checkCacheThresholds(cacheName, metrics);
	}

	/**
	 * Get or create cache metrics for a cache name
	 */
	private getOrCreateCacheMetrics(cacheName: string): CacheMetrics {
		if (!this.cacheMetrics.has(cacheName)) {
			this.cacheMetrics.set(cacheName, {
				hits: 0,
				misses: 0,
				evictions: 0,
				memoryUsage: 0
			});
		}
		return this.cacheMetrics.get(cacheName)!;
	}

	/**
	 * Get cache hit rate
	 */
	getCacheHitRate(cacheName: string): number {
		const metrics = this.cacheMetrics.get(cacheName);
		if (!metrics) return 0;

		const total = metrics.hits + metrics.misses;
		if (total === 0) return 0;

		return (metrics.hits / total) * 100;
	}

	/**
	 * Check cache performance thresholds
	 */
	private checkCacheThresholds(cacheName: string, metrics: CacheMetrics): void {
		const hitRate = this.getCacheHitRate(cacheName);

		// Alert on low hit rate (< 70%)
		if (hitRate > 0 && hitRate < 70) {
			this.createAlert({
				metric: `cache.${cacheName}.hitRate`,
				value: hitRate,
				threshold: 70,
				severity: 'medium',
				message: `Cache hit rate for ${cacheName} is ${hitRate.toFixed(1)}%, below threshold of 70%`
			});
		}

		// Alert on high memory usage (> 100MB)
		if (metrics.memoryUsage > 100 * 1024 * 1024) {
			this.createAlert({
				metric: `cache.${cacheName}.memoryUsage`,
				value: metrics.memoryUsage,
				threshold: 100 * 1024 * 1024,
				severity: 'high',
				message: `Cache ${cacheName} using ${this.formatBytes(metrics.memoryUsage)}, exceeding 100MB limit`
			});
		}
	}

	// ==========================================
	// Database Monitoring
	// ==========================================

	/**
	 * Record database query performance
	 */
	recordDatabaseQuery(operation: string, duration: number): void {
		this.dbMetrics.queryCount++;
		this.dbMetrics.totalQueryTime += duration;
		this.dbMetrics.averageQueryTime = this.dbMetrics.totalQueryTime / this.dbMetrics.queryCount;

		// Record slow queries (> 100ms)
		if (duration > 100) {
			this.dbMetrics.slowQueries.push({
				operation,
				duration,
				timestamp: Date.now()
			});

			// Keep only last 100 slow queries
			if (this.dbMetrics.slowQueries.length > 100) {
				this.dbMetrics.slowQueries = this.dbMetrics.slowQueries.slice(-100);
			}

			this.createAlert({
				metric: 'database.slowQuery',
				value: duration,
				threshold: 100,
				severity: 'medium',
				message: `Slow database query: ${operation} took ${duration.toFixed(1)}ms`
			});
		}
	}

	// ==========================================
	// Memory Monitoring
	// ==========================================

	/**
	 * Capture current memory usage
	 */
	private captureMemoryMetrics(): void {
		if (typeof window === 'undefined' || !('performance' in window)) return;

		const memory = (performance as any).memory;
		if (!memory) return;

		const metrics: MemoryMetrics = {
			usedJSHeapSize: memory.usedJSHeapSize,
			totalJSHeapSize: memory.totalJSHeapSize,
			jsHeapSizeLimit: memory.jsHeapSizeLimit,
			timestamp: Date.now()
		};

		this.memoryHistory.push(metrics);

		// Keep only last N metrics
		if (this.memoryHistory.length > this.maxMemoryHistory) {
			this.memoryHistory = this.memoryHistory.slice(-this.maxMemoryHistory);
		}

		// Check thresholds
		const usedMB = metrics.usedJSHeapSize / (1024 * 1024);
		const limitMB = metrics.jsHeapSizeLimit / (1024 * 1024);

		if (usedMB > 200) {
			this.createAlert({
				metric: 'memory.heapUsage',
				value: metrics.usedJSHeapSize,
				threshold: this.performanceBudgets.maxMemoryUsage,
				severity: usedMB > 300 ? 'critical' : 'high',
				message: `High memory usage: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB`
			});
		}
	}

	/**
	 * Get average memory usage over time period
	 */
	getAverageMemoryUsage(minutes: number = 5): number {
		const cutoff = Date.now() - minutes * 60 * 1000;
		const recent = this.memoryHistory.filter((m) => m.timestamp >= cutoff);

		if (recent.length === 0) return 0;

		const average = recent.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / recent.length;
		return average / (1024 * 1024); // Return in MB
	}

	// ==========================================
	// Alert Management
	// ==========================================

	/**
	 * Create performance alert
	 */
	private createAlert(data: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
		const alert: PerformanceAlert = {
			id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			...data,
			timestamp: Date.now()
		};

		this.alerts.push(alert);

		// Keep only last N alerts
		if (this.alerts.length > this.maxAlerts) {
			this.alerts = this.alerts.slice(-this.maxAlerts);
		}

		// Log critical alerts immediately
		if (alert.severity === 'critical' || alert.severity === 'high') {
			console.warn(`[Performance Alert] ${alert.message}`);
		}
	}

	/**
	 * Get recent alerts
	 */
	getAlerts(minutes: number = 15): PerformanceAlert[] {
		const cutoff = Date.now() - minutes * 60 * 1000;
		return this.alerts.filter((a) => a.timestamp >= cutoff);
	}

	/**
	 * Clear alerts
	 */
	clearAlerts(): void {
		this.alerts = [];
	}

	// ==========================================
	// Metrics Summary
	// ==========================================

	/**
	 * Get complete metrics snapshot
	 */
	getMetricsSnapshot(): MetricsSnapshot {
		return {
			timestamp: Date.now(),
			cache: Object.fromEntries(this.cacheMetrics),
			database: { ...this.dbMetrics },
			memory: this.memoryHistory.length > 0 ? this.memoryHistory[this.memoryHistory.length - 1] : null,
			alerts: this.getAlerts()
		};
	}

	/**
	 * Log metrics summary
	 */
	private logMetricsSummary(): void {
		const snapshot = this.getMetricsSnapshot();

		console.group('[Performance Monitor] Metrics Summary');

		// Cache metrics
		for (const [cacheName, metrics] of Object.entries(snapshot.cache)) {
			const hitRate = this.getCacheHitRate(cacheName);
			console.log(`Cache ${cacheName}: ${hitRate.toFixed(1)}% hit rate, ${metrics.evictions} evictions`);
		}

		// Database metrics
		console.log(`Database: ${snapshot.database.queryCount} queries, avg ${snapshot.database.averageQueryTime.toFixed(1)}ms`);

		// Memory metrics
		if (snapshot.memory) {
			const usedMB = snapshot.memory.usedJSHeapSize / (1024 * 1024);
			console.log(`Memory: ${usedMB.toFixed(1)}MB used`);
		}

		// Alerts
		const recentAlerts = this.getAlerts();
		if (recentAlerts.length > 0) {
			console.warn(`Alerts: ${recentAlerts.length} performance alerts in last 15 minutes`);
		}

		console.groupEnd();
	}

	/**
	 * Cleanup old metrics
	 */
	private cleanupOldMetrics(): void {
		const cutoff = Date.now() - 60 * 60 * 1000; // Keep last hour

		// Cleanup old memory metrics
		this.memoryHistory = this.memoryHistory.filter((m) => m.timestamp >= cutoff);

		// Cleanup old alerts
		this.alerts = this.alerts.filter((a) => a.timestamp >= cutoff);
	}

	// ==========================================
	// Performance Budgets
	// ==========================================

	/**
	 * Check if metrics exceed performance budgets
	 */
	checkPerformanceBudgets(): Array<{ metric: string; value: number; budget: number; passed: boolean }> {
		const results = [];

		// Check bundle size (requires build-time check)
		// This is checked in CI/CD pipeline

		// Check memory usage
		const currentMemory = this.getAverageMemoryUsage();
		results.push({
			metric: 'memory',
			value: currentMemory,
			budget: this.performanceBudgets.maxMemoryUsage / (1024 * 1024),
			passed: currentMemory < this.performanceBudgets.maxMemoryUsage / (1024 * 1024)
		});

		// Check cache hit rates
		for (const [cacheName] of this.cacheMetrics) {
			const hitRate = this.getCacheHitRate(cacheName);
			results.push({
				metric: `cache.${cacheName}.hitRate`,
				value: hitRate,
				budget: 70, // 70% minimum hit rate
				passed: hitRate >= 70
			});
		}

		// Check database query performance
		results.push({
			metric: 'database.avgQueryTime',
			value: this.dbMetrics.averageQueryTime,
			budget: 100, // 100ms max average
			passed: this.dbMetrics.averageQueryTime < 100
		});

		return results;
	}

	// ==========================================
	// Utilities
	// ==========================================

	/**
	 * Format bytes to human readable string
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
	}

	/**
	 * Reset all metrics
	 */
	resetMetrics(): void {
		this.cacheMetrics.clear();
		this.dbMetrics = {
			queryCount: 0,
			slowQueries: [],
			averageQueryTime: 0,
			totalQueryTime: 0
		};
		this.memoryHistory = [];
		this.alerts = [];
	}
}

// Global monitoring instance
export const productionMonitor = ProductionMonitor.getInstance();
