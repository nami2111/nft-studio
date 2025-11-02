<script lang="ts">
	import {
		usePerformanceMonitoring,
		getSlowestOperations,
		getMostFrequentOperations
	} from '$lib/stores/performance-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { globalResourceManager } from '$lib/stores/resource-manager';
	import { onMount } from 'svelte';

	// Performance monitoring hook
	const {
		isEnabled,
		stats,
		report,
		summary,
		slowestOps,
		frequentOps,
		toggle,
		clearAll,
		getFormattedAverageTime,
		getFormattedTotalDuration
	} = usePerformanceMonitoring();

	// Real-time metrics state
	let realTimeMetrics = $state({
		activeWorkers: 0,
		cacheHitRate: 0,
		memoryUsage: 0,
		generationSpeed: 0,
		queueLength: 0,
		cacheStats: {
			imageBitmap: { hitRate: 0, entries: 0 },
			imageData: { hitRate: 0, entries: 0 },
			arrayBuffer: { hitRate: 0, entries: 0 }
		}
	});

	let updateInterval: number | null = null;

	// Computed values
	let hasData = $derived(Object.keys(stats).length > 0);
	let showDetails = $state(false);
	let showRealTime = $state(true); // Show real-time metrics by default

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function toggleRealTime() {
		showRealTime = !showRealTime;
	}

	function refreshData() {
		// Force update by accessing the hook's reactive properties
		void summary;
		void slowestOps;
		void frequentOps;
	}

	function updateRealTimeMetrics() {
		try {
			// Get cache metrics from resource manager
			const cacheMetrics = globalResourceManager.getCacheMetrics();
			
			// Calculate average cache hit rate from the metrics
			const totalOps = cacheMetrics.overall.totalHits + cacheMetrics.overall.totalMisses;
			const avgCacheHitRate = totalOps > 0 
				? cacheMetrics.overall.totalHits / totalOps 
				: 0;

			// Update metrics (placeholder values for worker stats)
			realTimeMetrics = {
				...realTimeMetrics,
				activeWorkers: Math.floor(Math.random() * 4) + 1, // Mock data - would come from worker pool
				cacheHitRate: avgCacheHitRate,
				memoryUsage: cacheMetrics.overall.totalMemoryUsage,
				generationSpeed: Math.floor(Math.random() * 10) + 1, // Mock generation speed
				queueLength: Math.floor(Math.random() * 5), // Mock queue length
				cacheStats: {
					imageBitmap: { 
						hitRate: cacheMetrics.imageBitmap.hitRate, 
						entries: cacheMetrics.imageBitmap.currentEntries 
					},
					imageData: { 
						hitRate: cacheMetrics.imageData.hitRate, 
						entries: cacheMetrics.imageData.currentEntries 
					},
					arrayBuffer: { 
						hitRate: cacheMetrics.arrayBuffer.hitRate, 
						entries: cacheMetrics.arrayBuffer.currentEntries 
					}
				}
			};
		} catch (error) {
			console.warn('Failed to update real-time metrics:', error);
		}
	}

	onMount(() => {
		// Update metrics every 2 seconds
		updateInterval = setInterval(updateRealTimeMetrics, 2000);
		
		// Initial update
		updateRealTimeMetrics();

		return () => {
			if (updateInterval) {
				clearInterval(updateInterval);
			}
		};
	});

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="performance-monitor space-y-4 p-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center space-x-2">
			<h3 class="text-lg font-semibold">Performance Monitor</h3>
			<span
				class="rounded-full px-2 py-1 text-xs {isEnabled
					? 'bg-green-100 text-green-800'
					: 'bg-gray-100 text-gray-800'}"
			>
				{isEnabled ? 'Enabled' : 'Disabled'}
			</span>
		</div>
		<div class="flex items-center space-x-2">
			<Button size="sm" variant="outline" onclick={refreshData}>Refresh</Button>
			<Button size="sm" variant="outline" onclick={toggleRealTime}>
				{showRealTime ? 'Hide' : 'Show'} Real-time
			</Button>
			<Button size="sm" variant="outline" onclick={toggle}>
				{isEnabled ? 'Disable' : 'Enable'}
			</Button>
			<Button size="sm" variant="outline" onclick={clearAll} disabled={!hasData}>Clear All</Button>
		</div>
	</div>

	<!-- Real-time Performance Dashboard -->
	{#if isEnabled && showRealTime}
		<div class="border-t pt-4">
			<div class="flex items-center justify-between mb-3">
				<h4 class="text-md font-semibold">Real-time Performance</h4>
				<div class="text-xs text-muted-foreground">
					Updated every 2s
				</div>
			</div>
			
			<div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
				<Card>
					<CardHeader class="pb-1">
						<CardTitle class="text-xs font-medium">Active Workers</CardTitle>
					</CardHeader>
					<CardContent class="pt-0">
						<div class="text-xl font-bold text-blue-600">{realTimeMetrics.activeWorkers}</div>
						<div class="text-xs text-muted-foreground">running</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-1">
						<CardTitle class="text-xs font-medium">Cache Hit Rate</CardTitle>
					</CardHeader>
					<CardContent class="pt-0">
						<div class="text-xl font-bold text-green-600">
							{(realTimeMetrics.cacheHitRate * 100).toFixed(1)}%
						</div>
						<div class="text-xs text-muted-foreground">average</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-1">
						<CardTitle class="text-xs font-medium">Memory Usage</CardTitle>
					</CardHeader>
					<CardContent class="pt-0">
						<div class="text-xl font-bold text-purple-600">
							{formatBytes(realTimeMetrics.memoryUsage)}
						</div>
						<div class="text-xs text-muted-foreground">caches + URLs</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-1">
						<CardTitle class="text-xs font-medium">Gen Speed</CardTitle>
					</CardHeader>
					<CardContent class="pt-0">
						<div class="text-xl font-bold text-orange-600">
							{realTimeMetrics.generationSpeed}
						</div>
						<div class="text-xs text-muted-foreground">NFTs/sec</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-1">
						<CardTitle class="text-xs font-medium">Queue</CardTitle>
					</CardHeader>
					<CardContent class="pt-0">
						<div class="text-xl font-bold text-red-600">
							{realTimeMetrics.queueLength}
						</div>
						<div class="text-xs text-muted-foreground">pending</div>
					</CardContent>
				</Card>
			</div>

			<!-- Cache Breakdown -->
			<div class="mt-3">
				<h5 class="text-sm font-medium mb-2">Cache Performance</h5>
				<div class="grid grid-cols-3 gap-2">
					<div class="rounded border p-2 text-center">
						<div class="text-sm font-medium">ImageBitmap</div>
						<div class="text-lg font-bold text-blue-500">
							{(realTimeMetrics.cacheStats.imageBitmap.hitRate * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-muted-foreground">
							{realTimeMetrics.cacheStats.imageBitmap.entries} items
						</div>
					</div>
					<div class="rounded border p-2 text-center">
						<div class="text-sm font-medium">ImageData</div>
						<div class="text-lg font-bold text-green-500">
							{(realTimeMetrics.cacheStats.imageData.hitRate * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-muted-foreground">
							{realTimeMetrics.cacheStats.imageData.entries} items
						</div>
					</div>
					<div class="rounded border p-2 text-center">
						<div class="text-sm font-medium">ArrayBuffer</div>
						<div class="text-lg font-bold text-purple-500">
							{(realTimeMetrics.cacheStats.arrayBuffer.hitRate * 100).toFixed(0)}%
						</div>
						<div class="text-xs text-muted-foreground">
							{realTimeMetrics.cacheStats.arrayBuffer.entries} items
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if !isEnabled}
		<Card>
			<CardContent class="text-muted-foreground p-6 text-center">
				Performance monitoring is disabled. Enable it to start tracking operation metrics.
			</CardContent>
		</Card>
	{:else if !hasData}
		<Card>
			<CardContent class="text-muted-foreground p-6 text-center">
				No performance data available yet. Start using the application to see metrics.
			</CardContent>
		</Card>
	{:else}
		<!-- Summary Stats -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium">Total Operations</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{summary.totalOperations}</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium">Total Duration</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{summary.totalDuration}</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium">Average Time</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{summary.averageOperationTime}</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium">Slowest Operation</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="truncate text-lg font-bold" title={summary.slowestOperation}>
						{summary.slowestOperation}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium">Fastest Operation</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="truncate text-lg font-bold" title={summary.fastestOperation}>
						{summary.fastestOperation}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Toggle Details -->
		<div class="mt-4">
			<Button size="sm" variant="ghost" onclick={toggleDetails}>
				{showDetails ? 'Hide' : 'Show'} Detailed Metrics
			</Button>
		</div>

		{#if showDetails}
			<!-- Slowest Operations -->
			<div class="mt-6">
				<Card>
					<CardHeader>
						<CardTitle>Slowest Operations</CardTitle>
						<CardDescription>Operations with highest average execution time</CardDescription>
					</CardHeader>
					<CardContent>
						{#if slowestOps.length > 0}
							<div class="space-y-2">
								{#each slowestOps as op, index}
									<div class="flex items-center justify-between rounded border p-2">
										<span class="text-sm font-medium">{op.operation}</span>
										<span class="text-muted-foreground font-mono text-sm"
											>{op.formattedAvgTime}</span
										>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground">No slow operations recorded.</p>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Most Frequent Operations -->
			<div class="mt-4">
				<Card>
					<CardHeader>
						<CardTitle>Most Frequent Operations</CardTitle>
						<CardDescription>Operations called most often</CardDescription>
					</CardHeader>
					<CardContent>
						{#if frequentOps.length > 0}
							<div class="space-y-2">
								{#each frequentOps as op, index}
									<div class="flex items-center justify-between rounded border p-2">
										<span class="text-sm font-medium">{op.operation}</span>
										<span class="text-muted-foreground font-mono text-sm">{op.count} calls</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground">No operations recorded yet.</p>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- All Operations Details -->
			<div class="mt-4">
				<Card>
					<CardHeader>
						<CardTitle>All Operations</CardTitle>
						<CardDescription>Detailed metrics for all tracked operations</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-3">
							{#each Object.values(stats) as stat}
								<div class="rounded-lg border p-3">
									<div class="mb-2 flex items-center justify-between">
										<h4 class="font-semibold">{stat.operation}</h4>
										<div class="text-muted-foreground text-sm">{stat.count} calls</div>
									</div>
									<div class="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
										<div>
											<span class="text-muted-foreground">Avg:</span>
											<span class="ml-1 font-mono">{getFormattedAverageTime(stat.operation)}</span>
										</div>
										<div>
											<span class="text-muted-foreground">Min:</span>
											<span class="ml-1 font-mono">{stat.minDuration.toFixed(0)}ms</span>
										</div>
										<div>
											<span class="text-muted-foreground">Max:</span>
											<span class="ml-1 font-mono">{stat.maxDuration.toFixed(0)}ms</span>
										</div>
										<div>
											<span class="text-muted-foreground">Total:</span>
											<span class="ml-1 font-mono">{getFormattedTotalDuration(stat.operation)}</span
											>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			</div>
		{/if}
	{/if}
</div>

<style>
	.performance-monitor {
		max-width: 100%;
		overflow-x: auto;
	}
</style>
