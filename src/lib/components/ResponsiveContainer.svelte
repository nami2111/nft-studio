<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Content to render on all screen sizes */
		children: Snippet;
		/** Content to render on mobile screens */
		mobile?: Snippet;
		/** Content to render on tablet screens */
		tablet?: Snippet;
		/** Content to render on desktop screens */
		desktop?: Snippet;
		/** Additional CSS classes */
		class?: string;
	}

	let { children, mobile, tablet, desktop, class: className }: Props = $props();
</script>

<div class={className}>
	<!-- Mobile content -->
	{#if mobile}
		<div class="block md:hidden">
			{@render mobile()}
		</div>
	{/if}

	<!-- Tablet content -->
	{#if tablet}
		<div class="hidden md:block lg:hidden">
			{@render tablet()}
		</div>
	{/if}

	<!-- Desktop content -->
	{#if desktop}
		<div class="hidden lg:block">
			{@render desktop()}
		</div>
	{/if}

	<!-- Default content (shown on all screens if no specific content is provided) -->
	{#if !mobile && !tablet && !desktop}
		{@render children()}
	{/if}
</div>
