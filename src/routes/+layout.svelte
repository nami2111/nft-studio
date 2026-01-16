<script lang="ts">
	import { type Snippet } from 'svelte';
	import '../app.css';
	import SecurityPolicies from '$lib/components/SecurityPolicies.svelte';
	import { setupSessionCleanup } from '$lib/utils/session-cleanup';
	import { onMount } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		setupSessionCleanup();
	});
</script>

<div class="min-h-screen bg-white text-black">
	<SecurityPolicies />
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
