<script lang="ts">
	import { loadingStore } from '$lib/stores/loading.store';
	import { Loader2 } from 'lucide-svelte';
	
	interface Props {
		operation: string;
		message?: string;
	}
	
	const { operation, message = 'Loading...' }: Props = $props();
	
	let isLoading = $derived($loadingStore.isLoading(operation));
</script>

{#if isLoading}
	<div class="flex items-center">
		<Loader2 class="mr-2 h-4 w-4 animate-spin" />
		<span>{message}</span>
	</div>
{/if}