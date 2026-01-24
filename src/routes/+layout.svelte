<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import '../app.css';
	import SecurityPolicies from '$lib/components/project/SecurityPolicies.svelte';
	import { setupSessionCleanup } from '$lib/utils/session-cleanup';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		setupSessionCleanup();
	});

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

<div class="min-h-screen bg-white text-black">
	<SecurityPolicies />
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
