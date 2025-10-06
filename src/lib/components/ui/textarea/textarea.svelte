<script lang="ts">
	/**
	 * Textarea component with standardized props and accessibility features.
	 *
	 * @module Textarea
	 * @example
	 * ```svelte
	 * <Textarea placeholder="Enter your message" />
	 * <Textarea error="Please enter a valid message" />
	 * ```
	 */
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLTextareaAttributes {
		/** Number of rows for the textarea */
		rows?: number;
		/** Whether to show error state */
		error?: boolean | string;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		class: className = '',
		rows = 3,
		error = false,
		disabled = false,
		readonly = false,
		required = false,
		...restProps
	}: Props = $props();

	// Generate aria attributes for accessibility
	let ariaInvalid = $derived(error ? true : undefined);
	let errorId = $derived(restProps.id ? `${restProps.id}-error` : undefined);
	let ariaDescribedBy = $derived(errorId && error ? errorId : restProps['aria-describedby']);
</script>

<div class="w-full">
	<textarea
		class={cn(
			'border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			error && 'border-destructive focus-visible:ring-destructive',
			className
		)}
		{rows}
		{disabled}
		{readonly}
		{required}
		aria-invalid={ariaInvalid}
		aria-describedby={ariaDescribedBy}
		{...restProps}
	></textarea>
	{#if error && typeof error === 'string'}
		<p id={errorId} class="text-destructive text-sm font-medium" role="alert" aria-live="polite">
			{error}
		</p>
	{/if}
</div>
