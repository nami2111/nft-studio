<script lang="ts">
	/**
	 * Card title component with standardized props.
	 *
	 * @module CardTitle
	 * @example
	 * ```svelte
	 * <CardTitle>Card Title</CardTitle>
	 * ```
	 */
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

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
	data-slot="card-title"
	class={cn('leading-none font-semibold', className)}
	{...restProps}
>
	{@render children?.()}
</div>
