<script lang="ts">
	/**
	 * Dialog content component with standardized props and accessibility features.
	 *
	 * @module DialogContent
	 * @example
	 * ```svelte
	 * <DialogContent>
	 *   <DialogHeader>
	 *     <DialogTitle>Dialog Title</DialogTitle>
	 *     <DialogDescription>Dialog Description</DialogDescription>
	 *   </DialogHeader>
	 *   <div>Dialog Content</div>
	 * </DialogContent>
	 * ```
	 */
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import * as Dialog from './index.js';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Portal props */
		portalProps?: DialogPrimitive.PortalProps;
		/** Dialog content */
		children: Snippet;
		/** Whether to show close button */
		showCloseButton?: boolean;
		/** Accessibility label for the dialog */
		'aria-label'?: string;
		/** Accessibility description for the dialog */
		'aria-describedby'?: string;
		/** Whether the dialog is modal */
		modal?: boolean;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		children,
		showCloseButton = true,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy,
		modal = true,
		...restProps
	}: Props & { ref?: HTMLElement | null } = $props();

	// Filter out null values from restProps to avoid type issues with bits-ui
	let filteredRestProps = $derived({
		...restProps,
		id: restProps.id ? String(restProps.id) : undefined
	});

	// Generate aria attributes for accessibility
	let ariaModal = $derived(modal ? true : undefined);
</script>

<Dialog.Portal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		class={cn(
			'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
			className
		)}
		aria-label={ariaLabel}
		aria-describedby={ariaDescribedBy}
		aria-modal={ariaModal ? 'true' : undefined}
		role="dialog"
		{...filteredRestProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close
				class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
			>
				<XIcon />
				<span class="sr-only">Close</span>
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</Dialog.Portal>
