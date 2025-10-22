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

	// Computed values
	$: hasData = Object.keys(stats).length > 0;
	$: showDetails = false;

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function refreshData() {
		// Force update by accessing the hook's reactive properties
		void summary;
		void slowestOps;
		void frequentOps;
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
			<Button size="sm" variant="outline" onclick={toggle}>
				{isEnabled ? 'Disable' : 'Enable'}
			</Button>
			<Button size="sm" variant="outline" onclick={clearAll} disabled={!hasData}>Clear All</Button>
		</div>
	</div>

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
