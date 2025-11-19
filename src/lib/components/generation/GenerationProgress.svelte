<script lang="ts">
	import { Progress } from '$lib/components/ui/progress';
	import { AlertCircle } from 'lucide-svelte';
	import { generationState, resetState } from '$lib/stores/generation-progress.svelte';

	let { isBackground, isPaused, isGenerating } = $props<{
		isBackground: boolean;
		isPaused: boolean;
		isGenerating: boolean;
	}>();

	let progress = $derived(generationState.progress);
	let statusText = $derived(generationState.statusText);
	let memoryUsage = $derived(generationState.memoryUsage);
	let currentSessionId = $derived(generationState.sessionId);

	function handleClearState() {
		resetState();
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
			<Progress value={progress} max={100} class="w-full" />
			<p class="text-muted-foreground text-sm break-words">{statusText}</p>

			<!-- Generation Status Details -->
			{#if currentSessionId}
				<div class="text-muted-foreground space-y-1 text-xs">
					<p class="text-xs">Session: {currentSessionId.slice(0, 12)}...</p>
					{#if generationState.startTime}
						<p class="text-xs">
							Started: {new Date(generationState.startTime).toLocaleTimeString()}
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

			<!-- Warnings -->
			{#if generationState.warnings.length > 0}
				<div class="space-y-1 text-xs text-yellow-600">
					{#each generationState.warnings as warning (warning)}
						<p>⚠️ {warning}</p>
					{/each}
				</div>
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
