<script lang="ts">
	import {
		generationState,
		getSummary,
		cancelGeneration
	} from '$lib/stores/generation-progress.svelte';
	import { AlertCircle, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	// Derived state
	let isBackground = $derived(generationState.isBackground);
	let progress = $derived(generationState.progress);
	let statusText = $derived(generationState.statusText);
	let sessionId = $derived(generationState.sessionId);
	let currentItems = $derived(generationState.currentIndex);
	let totalItems = $derived(generationState.totalItems);
	let warnings = $derived(generationState.warnings);
	let error = $derived(generationState.error);

	// UI state
	let isMinimized = $state(false);

	function handleStop() {
		// Stop background generation directly
		cancelGeneration();
	}

	function handleDismiss() {
		// Dismiss the indicator (but keep generation running)
		isMinimized = true;
		setTimeout(() => {
			isMinimized = false;
		}, 5000); // Show again after 5 seconds
	}
</script>

{#if isBackground && !isMinimized}
	<div
		class="fixed right-4 bottom-4 z-50 max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
		role="alert"
		aria-live="polite"
	>
		<!-- Header -->
		<div class="flex items-start justify-between">
			<div class="flex flex-1 items-center gap-2">
				<div class="flex-shrink-0">
					<AlertCircle class="h-5 w-5 animate-pulse text-blue-500" />
				</div>
				<div>
					<h3 class="text-sm font-medium text-gray-900">Background Generation</h3>
					<p class="text-xs text-gray-500">
						Session {sessionId?.slice(0, 8)}...
					</p>
				</div>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onclick={handleDismiss}
				class="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
			>
				<X class="h-3 w-3" />
			</Button>
		</div>

		<!-- Progress -->
		<div class="space-y-2">
			<div class="flex justify-between text-xs text-gray-600">
				<span>{currentItems} / {totalItems} items</span>
				<span>{Math.round(progress)}%</span>
			</div>
			<div class="h-1.5 w-full rounded-full bg-gray-200">
				<div
					class="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
					style="width: {progress}%"
				></div>
			</div>
			<p class="text-xs text-gray-600">{statusText}</p>
		</div>

		<!-- Warnings -->
		{#if warnings.length > 0}
			<div class="rounded bg-yellow-50 p-2 text-xs text-yellow-600">
				<p class="font-medium">⚠️ {warnings.length} warning{warnings.length > 1 ? 's' : ''}</p>
				{#if warnings[0]}
					<p>{warnings[0]}</p>
				{/if}
			</div>
		{/if}

		<!-- Error -->
		{#if error}
			<div class="rounded bg-red-50 p-2 text-xs text-red-600">
				<p class="font-medium">❌ Error</p>
				<p>{error}</p>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-2 border-t border-gray-100 pt-2">
			<Button
				variant="outline"
				size="sm"
				onclick={handleStop}
				class="flex-1 text-red-600 hover:text-red-700"
			>
				Stop Background Generation
			</Button>
		</div>
	</div>
{/if}

<!-- Minimized indicator -->
{#if isBackground && isMinimized}
	<div
		class="fixed right-4 bottom-4 z-50 flex cursor-pointer items-center gap-2 rounded-full bg-blue-500 px-3 py-2 text-white shadow-lg transition-colors hover:bg-blue-600"
		onclick={() => (isMinimized = false)}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && (isMinimized = false)}
	>
		<div class="h-2 w-2 animate-pulse rounded-full bg-white"></div>
		<span class="text-xs font-medium">Background: {Math.round(progress)}%</span>
	</div>
{/if}

<style>
	/* Custom animations */
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.fixed {
		animation: slide-up 0.3s ease-out;
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
