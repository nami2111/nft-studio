<script lang="ts">
	import { loadingStates } from '$lib/stores';
	import Loader2 from '@lucide/svelte/icons/loader-2';

	interface Props {
		operation: string;
		message?: string;
		isLoading?: boolean;
	}

	const { operation, message = 'Loading...', isLoading: externalIsLoading }: Props = $props();

	// Create a reactive variable that updates when the loading state changes
	let isLoading = $derived(externalIsLoading ?? loadingStates[operation]);
</script>

{#if isLoading}
	<div class="flex items-center">
		<Loader2 class="mr-2 h-4 w-4 animate-spin" />
		<span>{message}</span>
	</div>
{/if}
