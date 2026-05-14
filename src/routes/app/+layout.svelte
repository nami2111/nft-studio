<script lang="ts">
    import { onMount, onDestroy, type Snippet } from "svelte";
    // import { initSatellite } from '@junobuild/core';
    import { Toaster } from "$lib/components/ui/sonner";
    import ErrorBoundary from "$lib/components/layout/ErrorBoundary.svelte";
    import { cleanupAllResources } from "$lib/stores";

    interface Props {
        children?: Snippet;
    }

    const { children }: Props = $props();

	onMount(async () => {
		try {
			const { warmUpWorkers } = await import("$lib/workers/pool");
			await warmUpWorkers();
        } catch (error) {
            console.warn("Worker warm-up failed (non-critical):", error);
        }

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

<div class="bg-background text-foreground relative min-h-screen">
    <!-- Simplified decorative background elements -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <!-- Subtle high contrast pattern - hidden on mobile for performance -->
        <div
            class="absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05)_0%,rgba(255,255,255,0)_70%)] sm:block"
        ></div>

        <!-- Minimal floating lines - hidden on mobile -->
        <div
            class="bg-border/20 absolute top-1/3 left-1/6 hidden h-px w-24 sm:block"
        ></div>
        <div
            class="bg-border/20 absolute top-2/3 right-1/4 hidden h-px w-20 sm:block"
        ></div>
    </div>

    <main id="main-content" class="relative z-10">
        <div
            class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 xl:max-w-screen-2xl 2xl:max-w-[1800px]"
        >
            <ErrorBoundary>
                {@render children?.()}
            </ErrorBoundary>

            <!-- Auto-save logic now handled by PersistenceService in projectStore -->
        </div>
    </main>
    <Toaster position="top-right" />
</div>
