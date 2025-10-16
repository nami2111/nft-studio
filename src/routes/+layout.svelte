<script lang="ts">
	import { type Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="bg-background text-foreground min-h-screen">
	<ModeWatcher />
	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
