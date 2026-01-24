<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Settings, LayoutGrid } from '@lucide/svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const modes = [
		{
			name: 'Generate Mode',
			route: '/app',
			icon: Settings
		},
		{
			name: 'Gallery Mode',
			route: '/app/gallery',
			icon: LayoutGrid
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
			window.location.href = nextMode.route;
		}}
		class="flex items-center gap-2 {className}"
	>
		{#if currentMode.icon}
			{@const IconComponent = currentMode.icon}
			<IconComponent class="h-4 w-4" />
		{/if}
		<span class="ml-2 hidden sm:inline">{currentMode.name}</span>
	</Button>
</div>
