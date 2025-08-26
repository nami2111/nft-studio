<script lang="ts">
	import { type Snippet } from 'svelte';
	import '../app.css';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-gray-900 text-gray-100">
	<main id="main-content">
		{@render children?.()}
	</main>
</div>
