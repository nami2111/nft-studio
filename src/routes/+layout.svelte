<script lang="ts">
	import { type Snippet } from 'svelte';
	import '../app.css';
	import SecurityPolicies from '$lib/components/SecurityPolicies.svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-white text-black">
	<SecurityPolicies />
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
