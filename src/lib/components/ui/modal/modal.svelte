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
		/** Maximum height class (e.g., 'max-h-[80vh]') */
		maxHeight?: string;
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
		maxHeight = 'max-h-[85vh]',
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
	<div use:portal={portalTarget} class="modal-container {maxWidth}">
		<NeoBrModal bind:open {title} onClose={handleClose}>
			{#if description}
				<p class="text-muted-foreground mb-4 text-sm">{description}</p>
			{/if}
			<div class={maxHeight}>
				{@render children?.()}
			</div>
		</NeoBrModal>
	</div>
{/if}

<style>
	/* Override NeoBr Modal's hardcoded max-w-lg on the card-brutalist element */
	.modal-container :global(.card-brutalist) {
		max-width: none !important;
	}

	.modal-container.max-w-xs :global(.card-brutalist) {
		max-width: 20rem !important;
	}

	.modal-container.max-w-sm :global(.card-brutalist) {
		max-width: 24rem !important;
	}

	.modal-container.max-w-md :global(.card-brutalist) {
		max-width: 28rem !important;
	}

	.modal-container.max-w-lg :global(.card-brutalist) {
		max-width: 32rem !important;
	}

	.modal-container.max-w-xl :global(.card-brutalist) {
		max-width: 36rem !important;
	}

	.modal-container.max-w-2xl :global(.card-brutalist) {
		max-width: 42rem !important;
	}

	.modal-container.max-w-3xl :global(.card-brutalist) {
		max-width: 48rem !important;
	}

	.modal-container.max-w-4xl :global(.card-brutalist) {
		max-width: 56rem !important;
	}

	.modal-container.max-w-5xl :global(.card-brutalist) {
		max-width: 64rem !important;
	}

	.modal-container.max-w-6xl :global(.card-brutalist) {
		max-width: 72rem !important;
	}

	.modal-container.max-w-7xl :global(.card-brutalist) {
		max-width: 80rem !important;
	}

	.modal-container.max-w-full :global(.card-brutalist) {
		max-width: 100% !important;
	}
</style>
