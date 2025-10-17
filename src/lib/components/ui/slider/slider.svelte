<script lang="ts">
	/**
	 * Slider component with standardized props and accessibility features.
	 *
	 * @module Slider
	 * @example
	 * ```svelte
	 * <Slider bind:value={sliderValue} min={0} max={100} step={1} />
	 * <Slider bind:value={rangeValue} min={0} max={100} step={10} orientation="vertical" />
	 * ```
	 */
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	interface Props {
		/** Minimum value */
		min?: number;
		/** Maximum value */
		max?: number;
		/** Step increment */
		step?: number;
		/** Whether the slider is disabled */
		disabled?: boolean;
		/** Accessibility label for the slider */
		'aria-label'?: string;
		/** Accessibility description for the slider */
		'aria-describedby'?: string;
		/** Additional CSS classes */
		class?: string;
		/** Slider orientation */
		orientation?: 'horizontal' | 'vertical';
		/** Slider value */
		value?: number[];
		/** Element reference */
		ref?: HTMLElement | null;
	}

	let {
		ref = $bindable(null),
		value = $bindable(),
		orientation = 'horizontal',
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		class: className,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy,
		...restProps
	}: Props = $props();

	// Generate aria attributes for accessibility
	let ariaOrientation = $derived(orientation);
	let ariaDisabled = $derived(disabled ? true : undefined);
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<SliderPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="slider"
	type="single"
	{orientation}
	{min}
	{max}
	{step}
	{disabled}
	aria-orientation={ariaOrientation}
	aria-disabled={ariaDisabled}
	aria-label={ariaLabel}
	aria-describedby={ariaDescribedBy}
	class={cn(
		'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbs })}
		<span
			data-orientation={orientation}
			data-slot="slider-track"
			class={cn(
				'relative h-1.5 w-full grow overflow-hidden rounded-full bg-gray-200 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
			)}
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class={cn('bg-primary absolute h-full data-[orientation=vertical]:w-full')}
			/>
		</span>
		{#each thumbs as thumb (thumb)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb}
				class="border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
