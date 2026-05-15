<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$components/shared/Icon.svelte';
	import { Setting07Icon, Image01Icon } from '@hugeicons/core-free-icons';

	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();

	const modes = [
		{
			name: 'Generate Mode',
			route: '/app',
			icon: Setting07Icon
		},
		{
			name: 'Gallery Mode',
			route: '/app/gallery',
			icon: Image01Icon
		}
	];

	const currentMode = $derived(modes.find((mode) => $page.url.pathname === mode.route) || modes[0]);
</script>

<div class="relative">
	<Button
		variant="outline"
		size="sm"
		onclick={() => {
			const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
			goto(nextMode.route);
		}}
		class="flex items-center gap-2 {className}"
	>
		{#if currentMode.icon}
			<Icon icon={currentMode.icon} class="h-4 w-4" />
		{/if}
		<span class="ml-2 hidden sm:inline">{currentMode.name}</span>
	</Button>
</div>
