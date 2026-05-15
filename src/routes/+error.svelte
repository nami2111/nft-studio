<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button } from '$components/ui/button/index.js';
	import Icon from '$components/shared/Icon.svelte';
	import { Home01Icon, RefreshIcon, Alert02Icon } from '@hugeicons/core-free-icons';

	const { status, message } = $derived($page.error ?? {});
</script>

<svelte:head>
	<title>{status ? `Error ${status}` : 'Error'} - GNStudio</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-black">
	<div class="w-full max-w-md text-center">
		<div class="mb-6 flex justify-center">
			<Icon icon={Alert02Icon} class="h-16 w-16 text-red-500" aria-hidden="true" />
		</div>

		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
			{#if status === 404}
				Page Not Found
			{:else if status}
				Error {status}
			{:else}
				Something Went Wrong
			{/if}
		</h1>

		<p class="mb-8 text-gray-600 dark:text-gray-400">
			{#if status === 404}
				The page you're looking for doesn't exist or has been moved.
			{:else if message}
				{message}
			{:else}
				An unexpected error occurred. Please try again.
			{/if}
		</p>

		<div class="flex items-center justify-center gap-3">
			<Button variant="default" onclick={() => goto('/')}>
				<Icon icon={Home01Icon} class="mr-2 h-4 w-4" />
				Go Home
			</Button>
			<Button variant="outline" onclick={() => window.location.reload()}>
				<Icon icon={RefreshIcon} class="mr-2 h-4 w-4" />
				Refresh
			</Button>
		</div>
	</div>
</div>
