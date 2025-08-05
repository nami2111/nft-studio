<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { initSatellite } from '@junobuild/core';
	import { Toaster } from '$lib/components/ui/sonner';
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
	<header class="bg-white shadow">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<h1 class="text-3xl font-bold text-gray-900">NFT Generative Collection Studio</h1>
		</div>
	</header>
	<main>
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			{@render children?.()}
		</div>
	</main>
	<Toaster position="top-right" />
</div>
