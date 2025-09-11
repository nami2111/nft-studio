<script lang="ts">
	/**
	 * Card component with standardized props and accessibility features.
	 *
	 * @module Card
	 * @example
	 * ```svelte
	 * <Card>
	 *   <CardHeader>
	 *     <CardTitle>Card Title</CardTitle>
	 *     <CardDescription>Card Description</CardDescription>
	 *   </CardHeader>
	 *   <CardContent>
	 *     <p>Card Content</p>
	 *   </CardContent>
	 * </Card>
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
	data-slot="card"
	class={cn('bg-card text-card-foreground rounded-lg border shadow-sm', className)}
	role="region"
	{...restProps}
>
	{@render children?.()}
</div>
