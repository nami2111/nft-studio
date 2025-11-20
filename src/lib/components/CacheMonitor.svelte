<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { globalResourceManager } from '$lib/stores/resource-manager';

	// Reactive state
	let metrics = $state<{
		imageBitmap: any;
		imageData: any;
		arrayBuffer: any;
		overall: any;
		memorySummary: any;
	}>({
		imageBitmap: {},
		imageData: {},
		arrayBuffer: {},
		overall: {},
		memorySummary: {
			totalUsage: '0 B',
			byCache: {
				imageBitmap: '0 B',
				imageData: '0 B',
				arrayBuffer: '0 B'
			},
			objectUrls: 0
		}
	});

	let interval: number;

	onMount(() => {
		// Update metrics every 2 seconds
		interval = setInterval(() => {
			updateMetrics();
		}, 2000);

		updateMetrics();
	});

	onDestroy(() => {
		if (interval) {
			clearInterval(interval);
		}
	});

	function updateMetrics() {
		const cacheMetrics = globalResourceManager.getCacheMetrics();
		const memorySummary = globalResourceManager.getMemorySummary();

		metrics = {
			imageBitmap: cacheMetrics.imageBitmap,
			imageData: cacheMetrics.imageData,
			arrayBuffer: cacheMetrics.arrayBuffer,
			overall: cacheMetrics.overall,
			memorySummary
		};
	}

	function clearCaches() {
		globalResourceManager.clearCaches();
		updateMetrics();
	}

	function cleanupExpired() {
		const cleaned = globalResourceManager.cleanupExpired();
		console.log(`Cleaned up ${cleaned} expired cache entries`);
		updateMetrics();
	}

	function formatHitRate(rate: number): string {
		return `${(rate * 100).toFixed(1)}%`;
	}

	function getHitRateClass(rate: number): string {
		if (rate > 0.8) return 'text-green-600';
		if (rate > 0.5) return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<div class="cache-monitor rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-800">Cache Monitor</h3>
		<div class="flex gap-2">
			<button
				onclick={cleanupExpired}
				class="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
			>
				Cleanup Expired
			</button>
			<button
				onclick={clearCaches}
				class="rounded bg-red-500 px-3 py-1 text-sm text-white transition-colors hover:bg-red-600"
			>
				Clear All
			</button>
		</div>
	</div>

	<!-- Memory Usage Summary -->
	<div class="mb-6">
		<h4 class="text-md mb-2 font-medium text-gray-700">Memory Usage</h4>
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded bg-gray-50 p-3">
				<div class="text-xs text-gray-500">Total</div>
				<div class="text-lg font-bold text-gray-800">{metrics.memorySummary.totalUsage}</div>
			</div>
			<div class="rounded bg-blue-50 p-3">
				<div class="text-xs text-blue-500">ImageBitmap</div>
				<div class="text-sm font-semibold text-blue-800">
					{metrics.memorySummary.byCache.imageBitmap}
				</div>
			</div>
			<div class="rounded bg-green-50 p-3">
				<div class="text-xs text-green-500">ImageData</div>
				<div class="text-sm font-semibold text-green-800">
					{metrics.memorySummary.byCache.imageData}
				</div>
			</div>
			<div class="rounded bg-purple-50 p-3">
				<div class="text-xs text-purple-500">ArrayBuffer</div>
				<div class="text-sm font-semibold text-purple-800">
					{metrics.memorySummary.byCache.arrayBuffer}
				</div>
			</div>
		</div>
	</div>

	<!-- Overall Statistics -->
	<div class="mb-6">
		<h4 class="text-md mb-2 font-medium text-gray-700">Overall Performance</h4>
		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded bg-gray-50 p-3">
				<div class="text-xs text-gray-500">Hit Rate</div>
				<div class="text-lg font-bold {getHitRateClass(metrics.overall.overallHitRate)}">
					{formatHitRate(metrics.overall.overallHitRate)}
				</div>
			</div>
			<div class="rounded bg-gray-50 p-3">
				<div class="text-xs text-gray-500">Total Hits</div>
				<div class="text-lg font-bold text-gray-800">
					{metrics.overall.totalHits.toLocaleString()}
				</div>
			</div>
			<div class="rounded bg-gray-50 p-3">
				<div class="text-xs text-gray-500">Total Misses</div>
				<div class="text-lg font-bold text-gray-800">
					{metrics.overall.totalMisses.toLocaleString()}
				</div>
			</div>
			<div class="rounded bg-gray-50 p-3">
				<div class="text-xs text-gray-500">Entries</div>
				<div class="text-lg font-bold text-gray-800">
					{metrics.overall.totalEntries.toLocaleString()}
				</div>
			</div>
		</div>
	</div>

	<!-- Cache Details -->
	<div class="space-y-4">
		<div>
			<h4 class="text-md mb-2 font-medium text-gray-700">ImageBitmap Cache</h4>
			<div class="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
				<div class="rounded bg-blue-50 p-2">
					<span class="text-blue-600">Size:</span>
					{metrics.imageBitmap.currentEntries}/{metrics.imageBitmap.maxEntries}
				</div>
				<div class="rounded bg-blue-50 p-2">
					<span class="text-blue-600">Memory:</span>
					{metrics.imageBitmap.currentSize >= 1024 * 1024
						? `${(metrics.imageBitmap.currentSize / (1024 * 1024)).toFixed(1)}MB`
						: `${(metrics.imageBitmap.currentSize / 1024).toFixed(1)}KB`}
				</div>
				<div class="rounded bg-blue-50 p-2">
					<span class="text-blue-600">Hit Rate:</span>
					<span class="font-semibold {getHitRateClass(metrics.imageBitmap.hitRate)}">
						{formatHitRate(metrics.imageBitmap.hitRate)}
					</span>
				</div>
			</div>
		</div>

		<div>
			<h4 class="text-md mb-2 font-medium text-gray-700">ImageData Cache</h4>
			<div class="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
				<div class="rounded bg-green-50 p-2">
					<span class="text-green-600">Size:</span>
					{metrics.imageData.currentEntries}/{metrics.imageData.maxEntries}
				</div>
				<div class="rounded bg-green-50 p-2">
					<span class="text-green-600">Memory:</span>
					{metrics.imageData.currentSize >= 1024 * 1024
						? `${(metrics.imageData.currentSize / (1024 * 1024)).toFixed(1)}MB`
						: `${(metrics.imageData.currentSize / 1024).toFixed(1)}KB`}
				</div>
				<div class="rounded bg-green-50 p-2">
					<span class="text-green-600">Hit Rate:</span>
					<span class="font-semibold {getHitRateClass(metrics.imageData.hitRate)}">
						{formatHitRate(metrics.imageData.hitRate)}
					</span>
				</div>
			</div>
		</div>

		<div>
			<h4 class="text-md mb-2 font-medium text-gray-700">ArrayBuffer Cache</h4>
			<div class="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
				<div class="rounded bg-purple-50 p-2">
					<span class="text-purple-600">Size:</span>
					{metrics.arrayBuffer.currentEntries}/{metrics.arrayBuffer.maxEntries}
				</div>
				<div class="rounded bg-purple-50 p-2">
					<span class="text-purple-600">Memory:</span>
					{metrics.arrayBuffer.currentSize >= 1024 * 1024
						? `${(metrics.arrayBuffer.currentSize / (1024 * 1024)).toFixed(1)}MB`
						: `${(metrics.arrayBuffer.currentSize / 1024).toFixed(1)}KB`}
				</div>
				<div class="rounded bg-purple-50 p-2">
					<span class="text-purple-600">Hit Rate:</span>
					<span class="font-semibold {getHitRateClass(metrics.arrayBuffer.hitRate)}">
						{formatHitRate(metrics.arrayBuffer.hitRate)}
					</span>
				</div>
			</div>
		</div>
	</div>

	<div class="mt-4 border-t border-gray-200 pt-4">
		<div class="text-xs text-gray-500">
			<strong>Object URLs tracked:</strong>
			{metrics.memorySummary.objectUrls}
		</div>
		<div class="mt-1 text-xs text-gray-500">
			<strong>Last updated:</strong>
			{new Date().toLocaleTimeString()}
		</div>
	</div>
</div>

<style>
	.cache-monitor {
		font-family: 'Inter', system-ui, sans-serif;
	}
</style>
