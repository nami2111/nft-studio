<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props<T = unknown> {
		/** Array of items to render */
		items: T[];
		/** Function to render each item */
		children: Snippet<[T]>;
		/** Additional CSS classes */
		class?: string;
		/** Key function for efficient rendering */
		key?: (item: T) => string | number;
		/** Whether to use virtualization for large lists */
		virtualized?: boolean;
		/** Estimated height of each item for virtualization */
		itemHeight?: number;
	}

	let {
		items,
		children,
		class: className,
		key,
		virtualized = false,
		itemHeight = 50
	}: Props = $props();
</script>

{#if virtualized}
	<div class={className + ' overflow-y-auto'} style="height: {items.length * itemHeight}px;">
		{#each items as item, i (key ? key(item) : i)}
			<div class="absolute" style="top: {i * itemHeight}px; height: {itemHeight}px; width: 100%;">
				{@render children(item)}
			</div>
		{/each}
	</div>
{:else}
	<div class={className}>
		{#each items as item, i (key ? key(item) : i)}
			<div>
				{@render children(item)}
			</div>
		{/each}
	</div>
{/if}
