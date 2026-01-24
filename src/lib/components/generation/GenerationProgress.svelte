<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';
	import { AlertCircle, CheckCircle2 } from '@lucide/svelte';
	import { generationState, resetState } from '$lib/stores/generation-progress.svelte';
	import { formatTime } from '$lib/utils/formatters';
	import { fade, slide, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { isBackground, isPaused, isGenerating } = $props<{
		isBackground: boolean;
		isPaused: boolean;
		isGenerating: boolean;
	}>();

	let progress = $derived(generationState.progress);
	let statusText = $derived(generationState.statusText);
	let memoryUsage = $derived(generationState.memoryUsage);
	let currentSessionId = $derived(generationState.sessionId);
	let itemsPerSecond = $derived(generationState.itemsPerSecond);
	let eta = $derived(generationState.eta);

	function handleClearState() {
		resetState();
	}

	let isCompleted = $derived(!isGenerating && !!generationState.completionTime && progress === 100);

	function formatEta(seconds: number | null): string {
		if (seconds === null || seconds < 0) return 'Estimating...';
		if (seconds < 60) return `${Math.round(seconds)}s`;
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return `${mins}m ${secs}s`;
	}
</script>

<div class="space-y-4 py-4">
	<!-- Background Generation Status -->
	{#if isBackground}
		<div class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
			<div class="flex items-center gap-2">
				<AlertCircle class="h-4 w-4 text-yellow-600" />
				<div class="flex-1">
					<p class="text-sm font-medium text-yellow-800">Generation Running in Background</p>
					<p class="text-xs text-yellow-600">
						Session {currentSessionId?.slice(0, 8)}... • {generationState.currentIndex} of {generationState.totalItems}
						items
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Progress Section -->
	<div class="grid gap-2 pb-2 sm:grid-cols-[1fr_3fr] sm:items-start sm:gap-4">
		<label class="text-sm font-medium sm:text-right" for="gen-progress">
			{isBackground ? 'Background Progress' : 'Progress'}
		</label>
		<div class="space-y-2">
			<div class="relative overflow-hidden rounded-full">
				<Progress
					value={progress}
					max={100}
					class="w-full transition-all duration-300 {isGenerating ? 'animate-pulse-subtle' : ''}"
				/>
				{#if isGenerating}
					<div
						class="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent"
					></div>
				{/if}
			</div>

			{#if isCompleted}
				<div
					in:scale={{ duration: 400, delay: 200, easing: quintOut }}
					class="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400"
				>
					<CheckCircle2 class="h-5 w-5" />
					<div class="flex-1">
						<p class="text-sm font-bold">Generation Complete!</p>
						<p class="text-xs opacity-80">{generationState.totalItems} NFTs ready for preview.</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-1">
					<p class="text-foreground text-sm font-medium wrap-break-word" in:slide>{statusText}</p>
					{#if isGenerating && (itemsPerSecond || eta !== null)}
						<div class="text-muted-foreground flex items-center gap-3 text-xs" in:fade>
							{#if itemsPerSecond}
								<span class="flex items-center gap-1">
									<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"></span>
									{itemsPerSecond.toFixed(1)} items/s
								</span>
							{/if}
							{#if eta !== null}
								<span class="flex items-center gap-1">
									⏱️ {formatEta(eta)} remaining
								</span>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Generation Status Details -->
			{#if currentSessionId}
				<div class="text-muted-foreground space-y-1 text-xs">
					<p class="text-xs">Session: {currentSessionId.slice(0, 12)}...</p>
					{#if generationState.startTime}
						<p class="text-xs">
							Started: {formatTime(generationState.startTime)}
						</p>
					{/if}
					{#if generationState.completionTime}
						<p class="text-xs">
							Finished: {formatTime(generationState.completionTime)}
						</p>
					{/if}
					{#if isPaused}
						<p class="text-yellow-600">⏸️ Paused</p>
					{:else if isBackground}
						<p class="text-blue-600">🔄 Running in background</p>
					{:else if !isGenerating && generationState.completionTime}
						<div class="flex items-center justify-end">
							<button
								onclick={handleClearState}
								class="text-muted-foreground hover:text-foreground text-xs underline"
							>
								Clear
							</button>
						</div>
					{/if}
				</div>
			{/if}

			{#if memoryUsage}
				<p class="text-muted-foreground text-sm">
					Memory: {Math.round(memoryUsage.used / 1024 / 1024)}MB / {Math.round(
						memoryUsage.available / 1024 / 1024
					)}MB
				</p>
			{/if}

			<!-- Error Display -->
			{#if generationState.error}
				<div class="rounded bg-red-50 p-2 text-xs text-red-600">
					❌ {generationState.error}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	:global(.animate-pulse-subtle) {
		animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse-subtle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.85;
		}
	}
</style>
