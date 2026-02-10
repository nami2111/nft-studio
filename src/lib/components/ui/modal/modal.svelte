<script module>
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
	import { Modal as NeoBrModal } from '@neobr/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		class?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto';
		onClose?: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		description = '',
		class: className,
		size = 'md',
		onClose,
		children
	}: Props = $props();

	function handleClose() {
		open = false;
		onClose?.();
	}

	let portalTarget = $state<HTMLElement | null>(null);

	$effect(() => {
		if (typeof document !== 'undefined') {
			portalTarget = document.body;
		}
	});

	const ModalComponent = NeoBrModal as any;
</script>

{#if portalTarget && open}
	<div use:portal={portalTarget}>
		<ModalComponent bind:open {title} {size} onClose={handleClose}>
			{#if description}
				<p class="text-muted-foreground mb-4 text-sm">{description}</p>
			{/if}
			{@render children?.()}
		</ModalComponent>
	</div>
{/if}
