<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { XIcon } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Whether the modal is open */
		open: boolean;
		/** Callback when modal should close */
		onClose: () => void;
		/** Modal content */
		children: Snippet;
		/** Modal title */
		title: string;
		/** Maximum width classes */
		maxWidth?: string;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		open = $bindable(),
		onClose,
		children,
		title,
		maxWidth = 'max-w-2xl',
		class: className,
		...restProps
	}: Props = $props();

	let modalElement = $state<HTMLElement>();
	let overlayElement = $state<HTMLElement>();

	// Handle ESC key to close
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			onClose();
		}
	}

	// Handle overlay click to close
	function handleOverlayClick(event: MouseEvent) {
		if (event.target === overlayElement && open) {
			onClose();
		}
	}

	// Handle viewport height changes for mobile keyboards
	function handleViewportChange() {
		if (modalElement && open) {
			const viewportHeight = window.visualViewport?.height || window.innerHeight;
			const modalHeight = modalElement.offsetHeight;
			const availableSpace = viewportHeight * 0.9;

			// If modal is too tall for viewport, adjust positioning
			if (modalHeight > availableSpace) {
				modalElement.style.maxHeight = `${availableSpace}px`;
				modalElement.style.overflowY = 'auto';
				modalElement.style.marginTop = '0';
			} else {
				// Center the modal vertically if it fits
				const topMargin = Math.max(0, (viewportHeight - modalHeight) / 2);
				modalElement.style.marginTop = `${topMargin}px`;
				modalElement.style.maxHeight = '';
				modalElement.style.overflowY = '';
			}
		}
	}

	// Focus management
	function focusModal() {
		if (modalElement && open) {
			const focusableElements = modalElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstFocusable = focusableElements[0] as HTMLElement;
			if (firstFocusable) {
				firstFocusable.focus();
			}
		}
	}

	// Prevent body scroll when modal is open
	function toggleBodyScroll() {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	// Set up event listeners
	onMount(() => {
		document.addEventListener('keydown', handleKeydown);

		// Handle viewport changes for mobile keyboards
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportChange);
		} else {
			// Fallback for browsers that don't support Visual Viewport API
			window.addEventListener('resize', handleViewportChange);
		}

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', handleViewportChange);
			} else {
				window.removeEventListener('resize', handleViewportChange);
			}
			document.body.style.overflow = '';
		};
	});

	// React to modal open/close
	$effect(() => {
		toggleBodyScroll();
		if (open) {
			// Small delay to ensure modal is rendered
			setTimeout(() => {
				focusModal();
				handleViewportChange();
				// Additional delay to ensure modal dimensions are calculated correctly
				setTimeout(() => {
					handleViewportChange();
				}, 50);
			}, 10);
		}
	});

	onDestroy(() => {
		document.body.style.overflow = '';
	});
</script>

{#if open}
	<div
		bind:this={overlayElement}
		class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]"
		onclick={handleOverlayClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<div
			bind:this={modalElement}
			class={cn(
				'z-50 my-auto max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-gray-800 bg-white shadow-2xl transition-all duration-200 sm:max-h-[85vh] dark:border-gray-200 dark:bg-gray-900',
				maxWidth,
				className
			)}
			{...restProps}
		>
			<!-- Modal Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">
					{title}
				</h2>
				<button
					type="button"
					class="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					onclick={onClose}
					aria-label="Close modal"
				>
					<XIcon class="h-5 w-5" />
				</button>
			</div>

			<!-- Modal Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
