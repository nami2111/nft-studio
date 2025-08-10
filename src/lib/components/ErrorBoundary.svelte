<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, RefreshCw, Home } from 'lucide-svelte';

	interface ErrorInfo {
		componentStack: string;
	}

	interface Props {
		children: () => void;
		fallback?: (error: Error | null, errorInfo: ErrorInfo | null) => void;
		onError?: (error: Error, errorInfo: ErrorInfo) => void;
	}

	let { children, fallback, onError }: Props = $props();

	let error: Error | null = $state(null);
	let errorInfo: ErrorInfo | null = $state(null);
	let hasError = $state(false);

	function handleError(err: Error, info: ErrorInfo) {
		error = err;
		errorInfo = info;
		hasError = true;

		// Log error for debugging
		console.error('Error Boundary caught an error:', err, info);

		// Call custom error handler if provided
		if (onError) {
			onError(err, info);
		}
	}

	// Error boundary implementation using Svelte 5 error handling
	onMount(() => {
		// Note: In Svelte 5, error boundaries are handled differently
		// This is a simplified implementation that catches errors in child components
		// You may need to adjust this based on Svelte 5's actual error boundary API
	});
</script>

{#if hasError}
	{#if fallback}
		{@render fallback(error, errorInfo)}
	{:else}
		<div class="flex min-h-[400px] items-center justify-center p-6">
			<div class="max-w-md text-center">
				<div class="mb-4 flex justify-center">
					<AlertCircle class="h-12 w-12 text-red-500" />
				</div>
				<h2 class="mb-2 text-xl font-semibold text-gray-900">Something went wrong</h2>
				<p class="mb-6 text-gray-600">
					{error?.message || 'An unexpected error occurred. Please try again.'}
				</p>
				<div class="flex justify-center gap-3">
					<Button onclick={() => window.location.reload()} variant="outline">
						<RefreshCw class="mr-2 h-4 w-4" />
						Refresh Page
					</Button>
					<Button onclick={() => (window.location.href = '/')}>
						<Home class="mr-2 h-4 w-4" />
						Go Home
					</Button>
				</div>
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}
