<script lang="ts">
	import { loadingStates } from '$lib/stores';
	import Icon from '$components/shared/Icon.svelte';
	import { RefreshIcon } from '@hugeicons/core-free-icons';

	interface Props {
		operation: string;
		message?: string;
		isLoading?: boolean;
	}

	const { operation, message = 'Loading...', isLoading: externalIsLoading }: Props = $props();

	// Create a reactive variable that updates when the loading state changes
	const isLoading = $derived(externalIsLoading ?? loadingStates[operation]);
</script>

{#if isLoading}
	<div class="flex items-center">
		<Icon icon={RefreshIcon} class="mr-2 h-4 w-4 animate-spin" />
		<span>{message}</span>
	</div>
{/if}
