<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';
	// import { initSatellite } from '@junobuild/core';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import AutoSave from '$lib/components/AutoSave.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { cleanupAllResources } from '$lib/stores';
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

<div class="bg-background text-foreground relative min-h-screen overflow-x-hidden">
	<ModeWatcher />
	<!-- Simplified decorative background elements -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden">
		<!-- Subtle high contrast pattern - hidden on mobile for performance -->
		<div
			class="absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05)_0%,rgba(255,255,255,0)_70%)] sm:block dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0)_70%)]"
		></div>

		<!-- Minimal floating lines - hidden on mobile -->
		<div class="bg-border/20 absolute top-1/3 left-1/6 hidden h-px w-24 sm:block"></div>
		<div class="bg-border/20 absolute top-2/3 right-1/4 hidden h-px w-20 sm:block"></div>
	</div>

	<main id="main-content" class="relative z-10">
		<div
			class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 xl:max-w-screen-2xl"
		>
			<!-- Figma-style header bar -->
			<div class="bg-card/95 mb-3 rounded-lg border shadow-sm backdrop-blur-sm sm:mb-4 md:mb-6">
				<div class="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
					<div class="flex items-center">
						<div class="flex space-x-1.5 sm:space-x-2">
							<div class="h-2.5 w-2.5 rounded-full bg-red-500 sm:h-3 sm:w-3"></div>
							<div class="h-2.5 w-2.5 rounded-full bg-yellow-500 sm:h-3 sm:w-3"></div>
							<div class="h-2.5 w-2.5 rounded-full bg-green-500 sm:h-3 sm:w-3"></div>
						</div>
						<div class="ml-2 text-xs font-medium sm:ml-3 sm:text-sm md:ml-4 md:text-base">
							NFT Studio
						</div>
					</div>
					<div class="flex items-center">
						<ThemeToggle />
					</div>
				</div>
			</div>

			<ErrorBoundary>
				{@render children?.()}
			</ErrorBoundary>

			<!-- Auto-save component for handling project persistence -->
			<AutoSave />
		</div>
	</main>
	<Toaster position="top-right" />
</div>
