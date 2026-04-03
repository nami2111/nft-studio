<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Content to render in the grid */
		children: Snippet;
		/** Number of columns on mobile */
		mobileCols?: number;
		/** Number of columns on tablet */
		tabletCols?: number;
		/** Number of columns on desktop */
		desktopCols?: number;
		/** Gap between grid items */
		gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		/** Additional CSS classes */
		class?: string;
	}

	const {
		children,
		mobileCols = 1,
		tabletCols = 2,
		desktopCols = 3,
		gap = 'md',
		class: className
	}: Props = $props();

	// Generate grid classes based on props
	const gridClasses = $derived(`
		grid gap-${gap}
		grid-cols-${mobileCols}
		sm:grid-cols-${Math.min(mobileCols, tabletCols)}
		md:grid-cols-${tabletCols}
		lg:grid-cols-${Math.max(tabletCols, desktopCols)}
		xl:grid-cols-${desktopCols}
		${className ?? ''}
	`);
</script>

<div class={gridClasses}>
	{@render children()}
</div>
