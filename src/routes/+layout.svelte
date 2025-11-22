<script lang="ts">
	import { type Snippet } from 'svelte';
	import '../app.css';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-white text-black">
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
