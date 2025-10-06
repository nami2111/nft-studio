<script lang="ts">
	/**
	 * Input component with standardized props and accessibility features.
	 *
	 * @module Input
	 * @example
	 * ```svelte
	 * <Input placeholder="Enter text" />
	 * <Input type="email" error="Please enter a valid email" />
	 * ```
	 */
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLInputAttributes {
		/** Input type */
		type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
		/** Minimum value for number inputs */
		min?: number | string;
		/** Maximum value for number inputs */
		max?: number | string;
		/** Input step for number inputs */
		step?: number | string;
		/** Whether to show error state */
		error?: boolean | string;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		class: className = '',
		type = 'text',
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
	<input
		class={cn(
			'border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			error && 'border-destructive focus-visible:ring-destructive',
			className
		)}
		{type}
		{disabled}
		{readonly}
		{required}
		aria-invalid={ariaInvalid}
		aria-describedby={ariaDescribedBy}
		{...restProps}
	/>
	{#if error && typeof error === 'string'}
		<p id={errorId} class="text-destructive text-sm font-medium" role="alert" aria-live="polite">
			{error}
		</p>
	{/if}
</div>
