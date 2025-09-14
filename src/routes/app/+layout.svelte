<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';
	// import { initSatellite } from '@junobuild/core';
	import { Toaster } from '$lib/components/ui/sonner';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import { cleanupAllResources } from '$lib/stores/runes-store';
	import '../../app.css';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	onMount(async () => {
		// Temporarily disabled Juno initialization due to dependency conflicts
		/*
		if (
			import.meta.env.VITE_APP_SATELLITE_ID &&
			import.meta.env.VITE_APP_SATELLITE_ID !== '<DEV_SATELLITE_ID>'
		) {
			try {
				await initSatellite({
					workers: {
						auth: true
					}
				});
			} catch (error) {
				console.error('Failed to initialize satellite:', error);
				// Show user-friendly error message
				import('svelte-sonner').then(({ toast }) => {
					toast.error('Failed to initialize application', {
						description: error instanceof Error ? error.message : 'Unknown error'
					});
				});
			}
		} else {
			console.warn(
				'Satellite initialization skipped: VITE_APP_SATELLITE_ID is not set or is a placeholder.'
			);
		}
		*/
	});

	onDestroy(() => {
		cleanupAllResources();
	});
</script>

<div class="relative min-h-screen overflow-hidden bg-gray-50">
	<!-- Simplified decorative background elements -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		<!-- Subtle grid pattern -->
		<div
			class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.03)_0%,rgba(255,255,255,0)_70%)]"
		></div>

		<!-- Minimal floating lines -->
		<div class="absolute top-1/3 left-1/6 h-px w-24 bg-blue-400/10"></div>
		<div class="absolute top-2/3 right-1/4 h-px w-20 bg-purple-400/10"></div>
	</div>

	<main id="main-content" class="relative z-10">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<!-- Figma-style header bar -->
			<div class="mb-6 rounded-lg border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
				<div class="flex items-center justify-between px-6 py-3">
					<div class="flex items-center">
						<div class="flex space-x-2">
							<div class="h-3 w-3 rounded-full bg-red-400"></div>
							<div class="h-3 w-3 rounded-full bg-yellow-400"></div>
							<div class="h-3 w-3 rounded-full bg-green-400"></div>
						</div>
						<div class="ml-4 text-sm font-medium text-gray-600">NFT Studio</div>
					</div>
					<div class="text-sm text-gray-500">Designer Mode</div>
				</div>
			</div>

			<ErrorBoundary>
				{@render children?.()}
			</ErrorBoundary>
		</div>
	</main>
	<Toaster position="top-right" />
</div>
