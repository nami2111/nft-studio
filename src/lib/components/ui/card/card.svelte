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
		/** Card variant style */
		variant?: 'default' | 'outline' | 'ghost';
		/** Additional CSS classes */
		class?: string;
	}

	let {
		ref = $bindable(null),
		class: className,
		children,
		variant = 'default',
		...restProps
	}: Props & { ref?: HTMLElement | null; children?: unknown } = $props();

	// Generate class based on variant
	let cardClass = $derived(
		cn(
			'flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
			variant === 'outline' && 'border-input bg-background',
			variant === 'ghost' && 'border-transparent bg-transparent shadow-none',
			variant === 'default' && 'bg-card text-card-foreground border shadow-sm',
			className
		)
	);
</script>

<div bind:this={ref} data-slot="card" class={cardClass} role="region" {...restProps}>
	{@render children?.()}
</div>
