<script lang="ts">
	import { Modal as NeoBrModal } from '@neobr/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto';
		onClose?: () => void;
		children?: Snippet;
	}

	/* eslint-disable prefer-const */
	let {
		open = $bindable(false),
		title = '',
		description = '',
		size = 'md',
		onClose,
		children
	}: Props = $props();

	function handleClose() {
		open = false;
		onClose?.();
	}

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return () => {
			if (node.parentNode === document.body) {
				document.body.removeChild(node);
			}
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ModalComponent = NeoBrModal as any;
</script>

{#if open}
	<div {@attach portalToBody}>
		<ModalComponent bind:open {title} {size} onClose={handleClose}>
			{#if description}
				<p class="text-muted-foreground mb-4 text-sm">{description}</p>
			{/if}
			{@render children?.()}
		</ModalComponent>
	</div>
{/if}
