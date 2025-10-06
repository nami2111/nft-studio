<script lang="ts">
	/**
	 * Card header component with standardized props.
	 *
	 * @module CardHeader
	 * @example
	 * ```svelte
	 * <CardHeader>
	 *   <CardTitle>Card Title</CardTitle>
	 *   <CardDescription>Card Description</CardDescription>
	 * </CardHeader>
	 * ```
	 */
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Additional CSS classes */
		class?: string;
	}

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: Props & { ref?: HTMLElement | null; children?: unknown } = $props();
</script>

<div
	bind:this={ref}
	data-slot="card-header"
	class={cn(
		'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
