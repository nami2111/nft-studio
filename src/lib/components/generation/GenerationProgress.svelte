<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';
	import Icon from '$components/shared/Icon.svelte';
	import { AlertCircleIcon, CheckmarkCircle01Icon, CpuIcon, LayerIcon, PackageIcon, SparklesIcon, Timer01Icon, PauseIcon, RefreshIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
	import { generationState, resetState } from '$lib/stores/generation-progress.svelte';
	import { formatTime } from '$lib/utils/formatters';
	import { fade, slide, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	const { isBackground, isPaused, isGenerating } = $props<{
		isBackground: boolean;
		isPaused: boolean;
		isGenerating: boolean;
	}>();

	const progress = $derived(generationState.progress);
	const statusText = $derived(generationState.statusText);
	const memoryUsageDisplay = $derived.by(() => {
		const memory = generationState.memoryUsage;
		if (memory === null) return null;
		if (typeof memory === 'number') return `${Math.round(memory / 1024 / 1024)}MB`;
		if (memory.units.toLowerCase() === 'bytes') {
			return `${Math.round(memory.used / 1024 / 1024)}MB / ${Math.round(memory.available / 1024 / 1024)}MB`;
		}
		return `${memory.used} / ${memory.available} ${memory.units}`;
	});
	const currentSessionId = $derived(generationState.sessionId);
	const itemsPerSecond = $derived(generationState.itemsPerSecond);
	const eta = $derived(generationState.eta);
	const batchProgress = $derived(generationState.batchProgress);

	const phase = $derived.by(() => {
		const text = generationState.statusText;
		if (!generationState.isGenerating && generationState.completionTime) return 'complete';
		if (text.includes('Solving')) return 'solving';
		if (text.includes('Packaging') || text.includes('Finalizing')) return 'packaging';
		if (text.includes('Batch') || text.includes('batch')) return 'generating';
		if (generationState.isGenerating) return 'generating';
		return 'idle';
	});

	const activeWorkers = $derived(batchProgress ? Math.min(batchProgress.total, 6) : 0);

	function handleClearState() {
		resetState();
	}

	const isCompleted = $derived(
		!isGenerating && !!generationState.completionTime && progress === 100
		&& !generationState.statusText.includes('Packaging')
	);

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
		<div class="mb-4 rounded-lg border-2 border-warning bg-warning/10 p-4">
			<div class="flex items-center gap-2">
				<Icon icon={AlertCircleIcon} class="text-warning h-4 w-4" />
				<div class="flex-1">
					<p class="text-warning text-sm font-medium">Generation Running in Background</p>
					<p class="text-muted-foreground text-xs">
						Session {currentSessionId?.slice(0, 8)}... • {generationState.currentIndex} of {generationState.totalItems}
						items
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Phase Indicator -->
	{#if currentSessionId && (isGenerating || generationState.statusText.includes('Packaging') || generationState.statusText.includes('Finalizing'))}
		<div class="flex items-center gap-1.5 text-xs" in:fade>
			{#each ['solving', 'generating', 'packaging'] as p (p)}
				<div
					class="flex items-center gap-1 rounded-full px-2.5 py-1 transition-all duration-300 {p === phase
						? 'bg-primary/10 text-primary font-medium'
						: 'text-muted-foreground/40'}"
				>
					{#if p === 'solving'}
						<Icon icon={LayerIcon} class="h-3 w-3" />
						<span>Solving</span>
					{:else if p === 'generating'}
						<Icon icon={CpuIcon} class="h-3 w-3" />
						<span>Generating</span>
					{:else if p === 'packaging'}
						<Icon icon={PackageIcon} class="h-3 w-3" />
						<span>Package</span>
					{/if}
					{#if p !== 'packaging'}
						<span class="text-muted-foreground/30">▸</span>
					{/if}
				</div>
			{/each}
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
					class="bg-success/10 text-success flex items-center gap-2 rounded-lg p-3"
				>
					<Icon icon={CheckmarkCircle01Icon} class="h-5 w-5" />
					<div class="flex-1">
						<p class="text-sm font-bold">Generation Complete!</p>
						<p class="text-xs opacity-80">{generationState.totalItems} items ready for preview.</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-1">
					<p class="text-foreground text-sm font-medium wrap-break-word" in:slide>{statusText}</p>
					{#if isGenerating && (itemsPerSecond || eta !== null || activeWorkers > 0)}
						<div class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" in:fade>
							{#if itemsPerSecond}
								<span class="flex items-center gap-1">
									<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"></span>
									{itemsPerSecond.toFixed(1)} items/s
								</span>
							{/if}
							{#if eta !== null}
								<span class="flex items-center gap-1">
									<Icon icon={Timer01Icon} class="h-3 w-3" />
									{formatEta(eta)} remaining
								</span>
							{/if}
							{#if activeWorkers > 0}
								<span class="flex items-center gap-1">
									<Icon icon={CpuIcon} class="h-3 w-3" />
									{activeWorkers}/6 workers
								</span>
							{/if}
							{#if generationState.currentIndex > 0}
								<span class="text-muted-foreground/60">
									{generationState.currentIndex}/{generationState.totalItems}
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
						<p class="text-warning flex items-center gap-1"><Icon icon={PauseIcon} class="h-3 w-3" /> Paused</p>
					{:else if isBackground}
						<p class="text-primary flex items-center gap-1"><Icon icon={RefreshIcon} class="h-3 w-3 animate-spin" /> Running in background</p>
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

			{#if memoryUsageDisplay}
				<p class="text-muted-foreground text-sm">Memory: {memoryUsageDisplay}</p>
			{/if}

			<!-- Error Display -->
			{#if generationState.error}
				<div class="bg-destructive/10 text-destructive flex items-center gap-1 rounded p-2 text-xs">
					<Icon icon={Cancel01Icon} class="h-3 w-3" /> {generationState.error}
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
