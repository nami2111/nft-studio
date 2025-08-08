<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { initSatellite } from '@junobuild/core';
	import { Toaster } from '$lib/components/ui/sonner';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import Hero from '$lib/components/Hero.svelte';
	import '../app.css';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	onMount(
		async () =>
			await initSatellite({
				workers: {
					auth: true
				}
			})
	);
</script>

<div class="min-h-screen bg-gray-50">
	<Hero />
	<main id="main-content">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<ErrorBoundary>
				{@render children?.()}
			</ErrorBoundary>
		</div>
	</main>
	<Toaster position="top-right" />
</div>
