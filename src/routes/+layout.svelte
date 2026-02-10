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
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html webManifestLink}
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<SecurityPolicies />
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
