<script module>
	/**
	 * Portal action to render content at a different DOM location
	 */
	export function portal(node: HTMLElement, target: HTMLElement) {
		target.appendChild(node);

		return {
			destroy() {
				if (node.parentNode === target) {
					target.removeChild(node);
				}
			}
		};
	}
</script>

<script lang="ts">
	/**
	 * Modal wrapper component that extends @neobr/svelte Modal with additional props.
	 * Adds maxWidth and description support while using the NeoBr-UI Modal internally.
	 */
	import { Modal as NeoBrModal } from '@neobr/svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** Whether the modal is open */
		open?: boolean;
		/** Modal title */
		title?: string;
		/** Modal description */
		description?: string;
		/** Additional CSS classes for the modal content */
		class?: string;
		/** Maximum width class (e.g., 'max-w-lg', 'max-w-4xl') */
		maxWidth?: string;
		/** Close handler */
		onClose?: () => void;
		/** Modal content */
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		description = '',
		class: className,
		maxWidth = 'max-w-lg',
		onClose,
		children
	}: Props = $props();

	function handleClose() {
		open = false;
		onClose?.();
	}

	// Portal target for rendering modal at body level
	let portalTarget = $state<HTMLElement | null>(null);

	$effect(() => {
		if (typeof document !== 'undefined') {
			portalTarget = document.body;
		}
	});
</script>

{#if portalTarget && open}
	<div use:portal={portalTarget} class={cn('modal-wrapper', maxWidth, className)}>
		<NeoBrModal bind:open {title} onClose={handleClose}>
			{#if description}
				<p class="text-muted-foreground mb-4 text-sm">{description}</p>
			{/if}
			{@render children?.()}
		</NeoBrModal>
	</div>
{/if}

<style>
	.modal-wrapper :global(.modal-content) {
		max-width: var(--modal-max-width, 32rem);
	}

	.modal-wrapper.max-w-xs :global(.modal-content) {
		max-width: 20rem;
	}

	.modal-wrapper.max-w-sm :global(.modal-content) {
		max-width: 24rem;
	}

	.modal-wrapper.max-w-md :global(.modal-content) {
		max-width: 28rem;
	}

	.modal-wrapper.max-w-lg :global(.modal-content) {
		max-width: 32rem;
	}

	.modal-wrapper.max-w-xl :global(.modal-content) {
		max-width: 36rem;
	}

	.modal-wrapper.max-w-2xl :global(.modal-content) {
		max-width: 42rem;
	}

	.modal-wrapper.max-w-3xl :global(.modal-content) {
		max-width: 48rem;
	}

	.modal-wrapper.max-w-4xl :global(.modal-content) {
		max-width: 56rem;
	}

	.modal-wrapper.max-w-5xl :global(.modal-content) {
		max-width: 64rem;
	}

	.modal-wrapper.max-w-6xl :global(.modal-content) {
		max-width: 72rem;
	}

	.modal-wrapper.max-w-7xl :global(.modal-content) {
		max-width: 80rem;
	}

	.modal-wrapper.max-w-full :global(.modal-content) {
		max-width: 100%;
	}
</style>
