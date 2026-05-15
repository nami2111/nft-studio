<script lang="ts">
	import { generationState } from '$lib/stores/generation-progress.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Progress } from '$lib/components/ui/progress';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDuration, formatTime } from '$lib/utils/formatters';
	import Icon from '$components/shared/Icon.svelte';
	import { Rocket01Icon, Alert01Icon, DatabaseIcon, Wrench01Icon, Analytics01Icon } from '@hugeicons/core-free-icons';

	let performanceStatus = $state({ isActive: false });
	let updateInterval: number;

	// Real-time performance metrics
	const currentSpeed = $derived(calculateCurrentSpeed());
	const estimatedCompletion = $derived(calculateEstimatedCompletion());
	const memoryEfficiency = $derived(getMemoryEfficiency());
	const algorithm = $derived(getCurrentAlgorithm());

	onMount(() => {
		// Update performance metrics every second
		updateInterval = window.setInterval(() => {
			performanceStatus = {
				isActive: generationState.isGenerating
			};
		}, 1000);
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
	});

	function calculateCurrentSpeed(): number {
		const elapsed = Date.now() - (generationState.startTime || 0);
		const itemsGenerated = generationState.currentIndex;
		return itemsGenerated > 0 ? itemsGenerated / (elapsed / 1000) : 0;
	}

	function calculateEstimatedCompletion(): string {
		const speed = currentSpeed;
		const remaining = generationState.totalItems - generationState.currentIndex;

		if (speed <= 0) return 'Calculating...';

		const secondsRemaining = remaining / speed;

		if (secondsRemaining < 60) {
			return `${Math.round(secondsRemaining)}s`;
		} else if (secondsRemaining < 3600) {
			return `${Math.round(secondsRemaining / 60)}m`;
		} else {
			return `${Math.round(secondsRemaining / 3600)}h`;
		}
	}

	function getMemoryEfficiency(): 'excellent' | 'good' | 'fair' | 'poor' {
		const memory = generationState.memoryUsage;
		if (!memory) return 'good';

		const usageRatio = memory.used / memory.available;
		if (usageRatio < 0.3) return 'excellent';
		if (usageRatio < 0.6) return 'good';
		if (usageRatio < 0.8) return 'fair';
		return 'poor';
	}

	function getCurrentAlgorithm(): string {
		return 'Unknown Algorithm';
	}

	function getEfficiencyColor(efficiency: string): string {
		switch (efficiency) {
			case 'excellent':
				return 'bg-green-500';
			case 'good':
				return 'bg-blue-500';
			case 'fair':
				return 'bg-yellow-500';
			case 'poor':
				return 'bg-red-500';
			default:
				return 'bg-gray-500';
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<div class="performance-dashboard space-y-4">
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Icon icon={Rocket01Icon} class="h-5 w-5" /> Performance Dashboard
				{#if performanceStatus.isActive}
					<Badge variant="outline" class="text-green-600">Live</Badge>
				{:else}
					<Badge variant="outline" class="text-gray-600">Inactive</Badge>
				{/if}
			</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if performanceStatus.isActive}
				<!-- Real-time metrics -->
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="metric-card">
						<div class="text-muted-foreground text-sm font-medium">Current Speed</div>
						<div class="text-2xl font-bold">
							{currentSpeed.toFixed(1)}
							<span class="text-muted-foreground text-sm font-normal">items/sec</span>
						</div>
					</div>

					<div class="metric-card">
						<div class="text-muted-foreground text-sm font-medium">Est. Completion</div>
						<div class="text-2xl font-bold">{estimatedCompletion}</div>
					</div>

					<div class="metric-card">
						<div class="text-muted-foreground text-sm font-medium">Algorithm</div>
						<div class="truncate text-lg font-semibold">{algorithm}</div>
					</div>

					<div class="metric-card">
						<div class="text-muted-foreground text-sm font-medium">Memory Efficiency</div>
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full {getEfficiencyColor(memoryEfficiency)}"></div>
							<span class="text-lg font-semibold capitalize">{memoryEfficiency}</span>
						</div>
					</div>
				</div>

				<!-- Progress bar with speed indicator -->
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span>Generation Progress</span>
						<span>{generationState.currentIndex} / {generationState.totalItems}</span>
					</div>
					<Progress value={generationState.progress} class="w-full" />
				</div>

				<!-- Performance recommendations -->
				{#if currentSpeed < 5}
					<div class="recommendation warning flex items-center gap-1">
						<Icon icon={Alert01Icon} class="h-4 w-4 shrink-0" /> Generation is running slower than expected. Consider using fast generation mode for
						better performance.
					</div>
				{/if}

				{#if memoryEfficiency === 'poor'}
					<div class="recommendation warning flex items-center gap-1">
						<Icon icon={DatabaseIcon} class="h-4 w-4 shrink-0" /> High memory usage detected. Consider reducing collection size or enabling batch
						processing.
					</div>
				{/if}

				{#if algorithm === 'existing-sophisticated'}
					<div class="recommendation info flex items-center gap-1">
						<Icon icon={Wrench01Icon} class="h-4 w-4 shrink-0" /> Using sophisticated generation for complex constraints. Fast generation could be
						faster for simpler collections.
					</div>
				{/if}
			{:else}
				<div class="text-muted-foreground py-8 text-center">
					Performance monitoring is not active.
					<br />
					Start a generation to see real-time performance metrics.
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Memory usage details -->
	{#if generationState.memoryUsage}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2"><Icon icon={DatabaseIcon} class="h-5 w-5" /> Memory Usage</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					<div class="flex justify-between">
						<span>Used:</span>
						<span class="font-mono">
							{formatBytes(generationState.memoryUsage.used)}
						</span>
					</div>
					<div class="flex justify-between">
						<span>Available:</span>
						<span class="font-mono">
							{formatBytes(generationState.memoryUsage.available)}
						</span>
					</div>
					<div class="flex justify-between">
						<span>Usage:</span>
						<span class="font-mono">
							{(
								(generationState.memoryUsage.used / generationState.memoryUsage.available) *
								100
							).toFixed(1)}%
						</span>
					</div>
				</div>

				<!-- Memory usage bar -->
				<div class="mt-4">
					<Progress
						value={(generationState.memoryUsage.used / generationState.memoryUsage.available) * 100}
						class="w-full"
					/>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Generation status details -->
	{#if generationState.sessionId}
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2"><Icon icon={Analytics01Icon} class="h-5 w-5" /> Generation Details</CardTitle>
			</CardHeader>
			<CardContent class="space-y-2">
				<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
					<div>
						<span class="font-medium">Session ID:</span>
						<span class="ml-2 font-mono">{generationState.sessionId.slice(0, 12)}...</span>
					</div>
					<div>
						<span class="font-medium">Started:</span>
						<span class="ml-2">
							{generationState.startTime ? formatTime(generationState.startTime) : 'Unknown'}
						</span>
					</div>
					<div>
						<span class="font-medium">Elapsed:</span>
						<span class="ml-2">
							{generationState.startTime
								? formatDuration(Date.now() - generationState.startTime)
								: '0s'}
						</span>
					</div>
					<div>
						<span class="font-medium">Progress:</span>
						<span class="ml-2">{generationState.progress.toFixed(1)}%</span>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
