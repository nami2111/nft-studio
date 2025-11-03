<script lang="ts">
	import { generationState, getSummary } from '$lib/stores/generation-progress.svelte.ts';
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
		// Stop background generation
		dispatchEvent(new CustomEvent('stop-background-generation'));
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
		class="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-3"
		role="alert"
		aria-live="polite"
	>
		<!-- Header -->
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-2 flex-1">
				<div class="flex-shrink-0">
					<AlertCircle class="h-5 w-5 text-blue-500 animate-pulse" />
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
			<div class="w-full bg-gray-200 rounded-full h-1.5">
				<div
					class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
					style="width: {progress}%"
				></div>
			</div>
			<p class="text-xs text-gray-600">{statusText}</p>
		</div>

		<!-- Warnings -->
		{#if warnings.length > 0}
			<div class="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
				<p class="font-medium">⚠️ {warnings.length} warning{warnings.length > 1 ? 's' : ''}</p>
				{#if warnings[0]}
					<p>{warnings[0]}</p>
				{/if}
			</div>
		{/if}

		<!-- Error -->
		{#if error}
			<div class="text-xs text-red-600 bg-red-50 p-2 rounded">
				<p class="font-medium">❌ Error</p>
				<p>{error}</p>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-2 pt-2 border-t border-gray-100">
			<Button variant="outline" size="sm" onclick={handleStop} class="flex-1 text-red-600 hover:text-red-700">
				Stop Background Generation
			</Button>
		</div>
	</div>
{/if}

<!-- Minimized indicator -->
{#if isBackground && isMinimized}
	<div
		class="fixed bottom-4 right-4 z-50 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 cursor-pointer hover:bg-blue-600 transition-colors"
		onclick={() => isMinimized = false}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && (isMinimized = false)}
	>
		<div class="h-2 w-2 bg-white rounded-full animate-pulse"></div>
		<span class="text-xs font-medium">Background: {Math.round(progress)}%</span>
	</div>
{/if}

<!-- Global event listeners for custom events -->
<svelte:window on:stop-background-generation={handleStop} />

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
		0%, 100% {
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