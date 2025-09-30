<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, RefreshCw, Home, FileText } from 'lucide-svelte';
	import { handleError, getDetailedErrorInfo } from '$lib/utils/error-handler';
	import type { AppError } from '$lib/utils/error-handling';

	interface ErrorInfo {
		componentStack: string;
		timestamp: Date;
		componentName?: string;
	}

	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		fallback?: Snippet<[{ error: Error | null; errorInfo: ErrorInfo | null }]>;
		onError?: (error: Error, errorInfo: ErrorInfo) => void;
		componentName?: string;
		resetOnNavigation?: boolean;
	}

	let { children, fallback, onError, componentName, resetOnNavigation = true }: Props = $props();

	let error: Error | null = $state(null);
	let errorInfo: ErrorInfo | null = $state(null);
	let hasError = $state(false);

	// Error handling for Svelte 5
	let unsubscribes: (() => void)[] = $state([]);

	function handleComponentError(err: Error, info: ErrorInfo) {
		error = err;
		errorInfo = {
			...info,
			timestamp: new Date(),
			componentName
		};
		hasError = true;

		// Log error with our error handler
		handleError(err, {
			context: {
				componentName,
				componentStack: info.componentStack,
				boundary: 'ErrorBoundary'
			},
			logError: true,
			silent: true // Don't show toast, we'll handle in UI
		});

		// Call custom error handler if provided
		if (onError) {
			onError(err, info);
		}
	}

	function resetError() {
		error = null;
		errorInfo = null;
		hasError = false;
	}

	function copyErrorDetails() {
		const errorDetails = {
			error: error ? getDetailedErrorInfo(error) : null,
			errorInfo,
			timestamp: new Date().toISOString(),
			url: window.location.href,
			userAgent: navigator.userAgent
		};

		navigator.clipboard
			.writeText(JSON.stringify(errorDetails, null, 2))
			.then(() => {
				// Could show a toast here if we had a toast system
				console.log('Error details copied to clipboard');
			})
			.catch((err) => {
				console.error('Failed to copy error details:', err);
			});
	}

	function handleNavigation() {
		if (resetOnNavigation) {
			resetError();
		}
	}

	onMount(() => {
		// Set up global error handlers for this boundary
		const originalConsoleError = console.error;

		// Override console.error to catch errors
		console.error = (...args: unknown[]) => {
			// Check if this looks like a component error
			if (args.some((arg) => typeof arg === 'string' && arg.includes('Error:'))) {
				const error = args.find((arg) => arg instanceof Error) as Error | undefined;
				if (error) {
					handleComponentError(error, {
						componentStack: new Error().stack?.split('\n').slice(2).join('\n') || '',
						timestamp: new Date()
					});
				}
			}

			originalConsoleError.apply(console, args);
		};

		unsubscribes.push(() => {
			console.error = originalConsoleError;
		});

		// Listen for navigation events
		if (resetOnNavigation) {
			const handlePopState = () => handleNavigation();
			window.addEventListener('popstate', handlePopState);

			unsubscribes.push(() => {
				window.removeEventListener('popstate', handlePopState);
			});
		}
	});

	onDestroy(() => {
		// Clean up all subscriptions
		unsubscribes.forEach((unsub) => unsub());
		unsubscribes = [];
	});
</script>

{#if hasError}
	{#if fallback}
		{@render fallback({ error, errorInfo })}
	{:else}
		<div class="flex min-h-[400px] items-center justify-center p-6" role="alert" aria-live="polite">
			<div class="max-w-md text-center">
				<div class="mb-4 flex justify-center">
					<AlertCircle class="h-12 w-12 text-red-500" aria-hidden="true" />
				</div>

				<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
					Something went wrong
				</h1>

				{#if error}
					<div class="mb-4 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
						<p class="text-sm text-red-800 dark:text-red-200">
							{error.message}
						</p>
						{#if error instanceof AppError && error.code}
							<p class="mt-1 text-xs text-red-600 dark:text-red-300">
								Error code: {error.code}
							</p>
						{/if}
					</div>
				{/if}

				{#if componentName}
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
						Component: {componentName}
					</p>
				{/if}

				<div class="mb-6 space-y-3">
					<Button
						onclick={() => window.location.reload()}
						variant="default"
						class="w-full"
						aria-label="Refresh the page to try again"
					>
						<RefreshCw class="mr-2 h-4 w-4" aria-hidden="true" />
						Refresh Page
					</Button>

					<Button
						onclick={() => (window.location.href = '/')}
						variant="outline"
						class="w-full"
						aria-label="Go back to the home page"
					>
						<Home class="mr-2 h-4 w-4" aria-hidden="true" />
						Go Home
					</Button>

					<Button
						onclick={copyErrorDetails}
						variant="ghost"
						class="w-full"
						aria-label="Copy error details to clipboard for debugging"
					>
						<FileText class="mr-2 h-4 w-4" aria-hidden="true" />
						Copy Error Details
					</Button>
				</div>

				<details class="text-left">
					<summary
						class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
					>
						Technical Details
					</summary>
					<div class="mt-2 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
						<pre>{errorInfo?.componentStack || 'No stack trace available'}</pre>
					</div>
				</details>
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	/* Ensure proper contrast and readability */
	:global(.dark) .text-gray-900 {
		color: rgb(243 244 246);
	}

	:global(.dark) .text-gray-600 {
		color: rgb(156 163 175);
	}

	:global(.dark) .text-gray-500 {
		color: rgb(107 114 128);
	}
</style>
