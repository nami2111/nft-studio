<script lang="ts">
	/**
	 * Progress component with standardized props and accessibility features.
	 *
	 * @module Progress
	 * @example
	 * ```svelte
	 * <Progress value={50} max={100} />
	 * <Progress value={75} max={100} aria-label="Upload progress" />
	 * ```
	 */
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	interface Props extends ProgressPrimitive.RootProps {
		/** Current progress value */
		value?: number;
		/** Maximum progress value */
		max?: number;
		/** Accessibility label for the progress bar */
		'aria-label'?: string;
		/** Accessibility description for the progress bar */
		'aria-describedby'?: string;
		/** Whether the progress is indeterminate */
		indeterminate?: boolean;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		ref = $bindable(null),
		class: className,
		max = 100,
		value,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy,
		indeterminate = false,
		...restProps
	}: Props = $props();

	// Generate aria attributes for accessibility
	let ariaValueNow = $derived(value !== undefined ? value : undefined);
	let ariaValueMin = $derived(0);
	let ariaValueMax = $derived(max);
	let ariaValueText = $derived(
		value !== undefined ? `${Math.round((value / max) * 100)}%` : undefined
	);
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	class={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
	{value}
	{max}
	aria-label={ariaLabel}
	aria-describedby={ariaDescribedBy}
	aria-valuenow={ariaValueNow}
	aria-valuemin={ariaValueMin}
	aria-valuemax={ariaValueMax}
	aria-valuetext={ariaValueText}
	role="progressbar"
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class={cn('bg-primary h-full w-full flex-1 transition-all', indeterminate && 'animate-pulse')}
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
	></div>
</ProgressPrimitive.Root>
