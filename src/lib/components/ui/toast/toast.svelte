<script lang="ts">
	/**
	 * Toast notification component with standardized props and accessibility features.
	 *
	 * @module Toast
	 * @example
	 * ```svelte
	 * <Toast message="Operation completed successfully" type="success" />
	 * <Toast message="Something went wrong" type="error" duration={5000} />
	 * ```
	 */
	import { cn } from '$lib/utils';
	import type { BaseComponentProps } from '../component.types';
	import { X } from '@lucide/svelte';

	// X is the correct component name, not XIcon
	const XIcon = X;

	interface Props extends BaseComponentProps {
		/** Toast message content */
		message: string;
		/** Toast type */
		type?: 'success' | 'error' | 'warning' | 'info';
		/** Duration in milliseconds before auto-dismiss */
		duration?: number;
		/** Whether the toast can be dismissed */
		dismissible?: boolean;
		/** Callback when toast is dismissed */
		onDismiss?: () => void;
	}

	let {
		message,
		type = 'info',
		duration = 5000,
		dismissible = true,
		onDismiss,
		class: className,
		...restProps
	}: Props = $props();

	let visible = $state(true);
	let timeoutId = $state<number | null>(null);

	// Set up auto-dismiss timer
	$effect(() => {
		if (duration > 0) {
			timeoutId = window.setTimeout(() => {
				dismiss();
			}, duration);
		}

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});

	// Dismiss the toast
	function dismiss() {
		visible = false;
		if (onDismiss) {
			onDismiss();
		}
	}

	// Get icon based on type
	let iconClass = $derived(
		cn(
			'size-4',
			type === 'success' && 'text-green-500',
			type === 'error' && 'text-red-500',
			type === 'warning' && 'text-yellow-500',
			type === 'info' && 'text-blue-500'
		)
	);

	// Get background class based on type
	let bgClass = $derived(
		cn(
			type === 'success' && 'bg-green-100 border-green-200',
			type === 'error' && 'bg-red-100 border-red-200',
			type === 'warning' && 'bg-yellow-100 border-yellow-200',
			type === 'info' && 'bg-blue-100 border-blue-200',
			'border'
		)
	);
</script>

{#if visible}
	<div
		class={cn(
			'fixed top-4 right-4 z-50 flex items-start gap-2 rounded-lg p-4 shadow-lg transition-all duration-300 ease-in-out',
			bgClass,
			className
		)}
		role="alert"
		aria-live="assertive"
		aria-atomic="true"
		{...restProps}
	>
		{#if type === 'success'}
			<svg
				class={iconClass}
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<title>Success</title>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
					clip-rule="evenodd"
				/>
			</svg>
		{:else if type === 'error'}
			<svg
				class={iconClass}
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<title>Error</title>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
					clip-rule="evenodd"
				/>
			</svg>
		{:else if type === 'warning'}
			<svg
				class={iconClass}
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<title>Warning</title>
				<path
					fill-rule="evenodd"
					d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
					clip-rule="evenodd"
				/>
			</svg>
		{:else}
			<svg
				class={iconClass}
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<title>Info</title>
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
					clip-rule="evenodd"
				/>
			</svg>
		{/if}
		<div class="flex-1 text-sm font-medium">{message}</div>
		{#if dismissible}
			<button
				class="text-muted-foreground hover:text-foreground rounded-xs p-1 transition-colors"
				onclick={dismiss}
				aria-label="Dismiss notification"
			>
				<XIcon class="size-4" />
			</button>
		{/if}
	</div>
{/if}

<style>
	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideOut {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(100%);
			opacity: 0;
		}
	}

	:global(.toast-enter) {
		animation: slideIn 0.3s ease-out;
	}

	:global(.toast-exit) {
		animation: slideOut 0.3s ease-in;
	}
</style>
