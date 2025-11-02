<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { AlertCircle, RefreshCw, Home, FileText, Wifi, Database, Cpu, HardDrive } from 'lucide-svelte';
	import { handleError, getDetailedErrorInfo } from '$lib/utils/error-handler';
	import { AppError } from '$lib/utils/error-handling';

	interface ErrorInfo {
		componentStack: string;
		timestamp: Date;
		componentName?: string;
	}

	// Enhanced error context with granular error types and recovery options
	interface EnhancedErrorInfo extends ErrorInfo {
		errorType: 'network' | 'storage' | 'memory' | 'generation' | 'validation' | 'worker' | 'unknown';
		recoveryOptions: string[];
		suggestedActions: string[];
		severity: 'low' | 'medium' | 'high' | 'critical';
	}

	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		fallback?: Snippet<[{ error: Error | null; errorInfo: EnhancedErrorInfo | null }]>;
		onError?: (error: Error, errorInfo: EnhancedErrorInfo) => void;
		componentName?: string;
		resetOnNavigation?: boolean;
		enableRetry?: boolean; // Enable automatic retry for recoverable errors
		maxRetries?: number; // Maximum retry attempts
	}

	let { children, fallback, onError, componentName, resetOnNavigation = true, enableRetry = true, maxRetries = 3 }: Props = $props();

	let error: Error | null = $state(null);
	let errorInfo: EnhancedErrorInfo | null = $state(null);
	let hasError = $state(false);
	let retryCount = $state(0);

	// Error handling for Svelte 5
	let unsubscribes: (() => void)[] = $state([]);

	/**
	 * Categorize error based on message and context
	 */
	function categorizeError(err: Error): {
		type: EnhancedErrorInfo['errorType'];
		severity: EnhancedErrorInfo['severity'];
		recoveryOptions: string[];
		suggestedActions: string[];
		icon: any;
	} {
		const message = err.message.toLowerCase();

		// Network errors
		if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
			return {
				type: 'network',
				severity: 'high',
				recoveryOptions: ['retry', 'offline-mode', 'check-connection'],
				suggestedActions: ['Check your internet connection', 'Try again in a moment', 'Use offline mode'],
				icon: Wifi
			};
		}

		// Storage errors
		if (message.includes('storage') || message.includes('localstorage') || message.includes('indexeddb')) {
			return {
				type: 'storage',
				severity: 'medium',
				recoveryOptions: ['clear-storage', 'use-memory-mode', 'refresh'],
				suggestedActions: ['Clear browser storage', 'Refresh the page', 'Try using memory mode'],
				icon: Database
			};
		}

		// Memory errors
		if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
			return {
				type: 'memory',
				severity: 'critical',
				recoveryOptions: ['clear-cache', 'reduce-quality', 'restart'],
				suggestedActions: ['Clear cache and cookies', 'Reduce image quality', 'Restart browser'],
				icon: HardDrive
			};
		}

		// Generation errors
		if (message.includes('generation') || message.includes('nft') || message.includes('worker')) {
			return {
				type: 'generation',
				severity: 'high',
				recoveryOptions: ['retry-generation', 'reduce-collection-size', 'check-workers'],
				suggestedActions: ['Retry generation', 'Reduce collection size', 'Check worker status'],
				icon: Cpu
			};
		}

		// Worker errors
		if (message.includes('worker') || message.includes('thread') || message.includes('web worker')) {
			return {
				type: 'worker',
				severity: 'high',
				recoveryOptions: ['restart-workers', 'fallback-main-thread', 'refresh'],
				suggestedActions: ['Restart workers', 'Use main thread', 'Refresh page'],
				icon: Cpu
			};
		}

		// Validation errors
		if (message.includes('validation') || message.includes('invalid') || message.includes('type')) {
			return {
				type: 'validation',
				severity: 'medium',
				recoveryOptions: ['check-inputs', 'reset-form', 'validate-data'],
				suggestedActions: ['Check input data', 'Reset form', 'Validate data'],
				icon: AlertCircle
			};
		}

		// Default unknown error
		return {
			type: 'unknown',
			severity: 'medium',
			recoveryOptions: ['retry', 'refresh', 'report-error'],
			suggestedActions: ['Try again', 'Refresh page', 'Report this error'],
			icon: AlertCircle
		};
	}

	function handleComponentError(err: Error, info: ErrorInfo) {
		const categorization = categorizeError(err);
		
		error = err;
		errorInfo = {
			...info,
			timestamp: new Date(),
			componentName,
			errorType: categorization.type,
			recoveryOptions: categorization.recoveryOptions,
			suggestedActions: categorization.suggestedActions,
			severity: categorization.severity
		};
		hasError = true;

		// Log error with our error handler
		handleError(err, {
			context: {
				component: componentName,
				action: 'error-boundary',
				userAction: 'component-rendering'
			},
			logError: true,
			silent: true // Don't show toast, we'll handle in UI
		});

		// Call custom error handler if provided
		if (onError) {
			onError(err, errorInfo);
		}
	}

	function resetError() {
		error = null;
		errorInfo = null;
		hasError = false;
		retryCount = 0;
	}

	/**
	 * Perform contextual retry based on error type
	 */
	function performContextualRetry() {
		if (!error || !errorInfo || retryCount >= maxRetries) {
			return;
		}

		retryCount++;
		resetError();

		// Wait a bit before retry for network issues
		if (errorInfo.errorType === 'network' || errorInfo.errorType === 'storage') {
			setTimeout(() => {
				// Trigger a re-render by forcing a state update
				hasError = false;
			}, 1000);
		}
	}

	/**
	 * Execute specific recovery action
	 */
	function executeRecoveryAction(action: string) {
		if (!errorInfo) return;

		switch (action) {
			case 'clear-cache':
				// Clear browser cache
				if ('caches' in window) {
					caches.keys().then((names) => {
						names.forEach((name) => caches.delete(name));
					});
				}
				localStorage.clear();
				sessionStorage.clear();
				break;

			case 'clear-storage':
				// Clear storage but preserve user data
				localStorage.removeItem('nft-studio-project');
				break;

			case 'reduce-quality':
				// Dispatch event to reduce image quality
				window.dispatchEvent(new CustomEvent('reduce-image-quality'));
				break;

			case 'restart-workers':
				// Dispatch event to restart workers
				window.dispatchEvent(new CustomEvent('restart-workers'));
				break;

			case 'offline-mode':
				// Dispatch event to enable offline mode
				window.dispatchEvent(new CustomEvent('enable-offline-mode'));
				break;
		}

		// Reset error after recovery action
		setTimeout(resetError, 500);
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
			<div class="max-w-2xl">
				<!-- Header with error type icon -->
				<div class="text-center mb-6">
					<div class="mb-4 flex justify-center">
						{#if errorInfo && error}
							{@const errorCategory = categorizeError(error)}
							<errorCategory.icon class="h-16 w-16 text-red-500" aria-hidden="true" />
						{:else}
							<AlertCircle class="h-16 w-16 text-red-500" aria-hidden="true" />
						{/if}
					</div>
					<h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
						{#if errorInfo?.errorType === 'network'}Connection Error
						{:else if errorInfo?.errorType === 'storage'}Storage Error
						{:else if errorInfo?.errorType === 'memory'}Memory Error
						{:else if errorInfo?.errorType === 'generation'}Generation Error
						{:else if errorInfo?.errorType === 'worker'}Worker Error
						{:else if errorInfo?.errorType === 'validation'}Validation Error
						{:else}Something went wrong{/if}
					</h1>
					<div class="flex items-center justify-center space-x-2">
						<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
							{errorInfo?.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
							errorInfo?.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
							'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'}">
							{errorInfo?.severity || 'medium'} severity
						</span>
						{#if componentName}
							<span class="text-sm text-gray-500">•</span>
							<span class="text-sm text-gray-600 dark:text-gray-400">{componentName}</span>
						{/if}
					</div>
				</div>

				{#if error}
					<div class="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
						<p class="text-sm text-red-800 dark:text-red-200 mb-2">
							{error.message}
						</p>
						{#if error instanceof AppError && error.code}
							<p class="text-xs text-red-600 dark:text-red-300">
								Error code: {error.code}
							</p>
						{/if}
					</div>
				{/if}

				<!-- Contextual Recovery Actions -->
				{#if errorInfo?.suggestedActions && errorInfo.suggestedActions.length > 0}
					<div class="mb-6">
						<h3 class="text-lg font-medium mb-3">What you can try:</h3>
						<div class="grid gap-2">
							{#each errorInfo.suggestedActions as action}
								<div class="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
									<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
									<span>{action}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="mb-6 space-y-3">
					{#if enableRetry && retryCount < maxRetries}
						<Button
							onclick={performContextualRetry}
							variant="default"
							class="w-full"
							disabled={retryCount >= maxRetries}
						>
							<RefreshCw class="mr-2 h-4 w-4" aria-hidden="true" />
							Retry ({maxRetries - retryCount} attempts left)
						</Button>
					{/if}

					<div class="grid grid-cols-2 gap-2">
						<Button
							onclick={() => window.location.reload()}
							variant="outline"
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
					</div>

					<!-- Contextual Recovery Buttons -->
					{#if errorInfo?.recoveryOptions && errorInfo.recoveryOptions.length > 0}
						<div class="border-t pt-3">
							<h4 class="text-sm font-medium mb-2">Quick fixes:</h4>
							<div class="grid grid-cols-1 gap-2">
								{#each errorInfo.recoveryOptions as option}
									<Button
										onclick={() => executeRecoveryAction(option)}
										variant="ghost"
										class="w-full justify-start text-sm"
									>
										{#if option === 'clear-cache'}
											<HardDrive class="mr-2 h-3 w-3" />
										{:else if option === 'clear-storage'}
											<Database class="mr-2 h-3 w-3" />
										{:else if option === 'restart-workers'}
											<Cpu class="mr-2 h-3 w-3" />
										{:else if option === 'offline-mode'}
											<Wifi class="mr-2 h-3 w-3" />
										{:else}
											<RefreshCw class="mr-2 h-3 w-3" />
										{/if}
										{option.replace('-', ' ')}
									</Button>
								{/each}
							</div>
						</div>
					{/if}

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

				<!-- Technical Details -->
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
