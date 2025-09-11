<script lang="ts">
	/**
	 * Button component with multiple variants and sizes.
	 *
	 * @module Button
	 * @example
	 * ```svelte
	 * <Button on:click={handleClick}>Click me</Button>
	 * <Button variant="destructive" size="lg">Delete</Button>
	 * ```
	 */
	import { tv, type VariantProps } from 'tailwind-variants';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { InteractiveProps } from '../component.types';

	const buttonVariants = tv({
		base: 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
				destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
				outline:
					'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-9 px-4 py-2',
				sm: 'h-8 rounded-md px-3 text-xs',
				lg: 'h-10 rounded-md px-8',
				icon: 'h-9 w-9'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	type Variant = VariantProps<typeof buttonVariants>;

	/**
	 * Button component props.
	 */
	interface Props extends InteractiveProps {
		/** Button variant style */
		variant?: Variant['variant'];
		/** Button size */
		size?: Variant['size'];
		/** Button content */
		children: Snippet;
		/** Button type for form submission */
		type?: 'button' | 'submit' | 'reset';
		/** Loading state */
		loading?: boolean;
		/** ARIA label for accessibility */
		'aria-label'?: string;
	}

	let {
		variant,
		size,
		class: className,
		children,
		onclick,
		disabled,
		type = 'button',
		loading = false,
		'aria-label': ariaLabel,
		...restProps
	}: Props = $props();
</script>

<button
	class={cn(buttonVariants({ variant, size, className }))}
	{onclick}
	{disabled}
	{type}
	aria-busy={loading}
	aria-label={ariaLabel}
	{...restProps}
>
	{#if loading}
		<svg
			class="mr-2 h-4 w-4 animate-spin"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<title>Loading</title>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{@render children()}
</button>
