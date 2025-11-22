<script lang="ts">
	/**
	 * Skeleton loading component with standardized props.
	 *
	 * @module Skeleton
	 * @example
	 * ```svelte
	 * <Skeleton class="h-10 w-full" />
	 * <Skeleton class="h-4 w-32 rounded-full" />
	 * ```
	 */
	import { cn } from '$lib/utils';
	import type { BaseComponentProps } from '../component.types';
	import type { Snippet } from 'svelte';

	interface Props extends BaseComponentProps {
		/** Whether the skeleton is loading */
		loading?: boolean;
		/** Content to render when not loading */
		children?: Snippet;
	}

	let { class: className, loading = true, children, ...restProps }: Props = $props();
</script>

{#if loading}
	<div
		class={cn('bg-muted animate-pulse rounded-md', className)}
		role="status"
		aria-label="Loading"
		{...restProps}
	></div>
{:else}
	{@render children?.()}
{/if}
