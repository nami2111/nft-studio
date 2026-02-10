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
	<div use:portal={portalTarget}>
		<NeoBrModal bind:open {title} onClose={handleClose}>
			{#if description}
				<p class="text-muted-foreground mb-4 text-sm">{description}</p>
			{/if}
			{@render children?.()}
		</NeoBrModal>
	</div>
{/if}
