<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const modes = [
		{
			name: 'Generate Mode',
			route: '/app',
			icon: `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`
		},
		{
			name: 'Gallery Mode',
			route: '/app/gallery',
			icon: `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1"/>
				<circle cx="8.5" cy="8.5" r="1.5" stroke-width="1"/>
				<polyline points="21 15 16 10 5 21" stroke-width="1"/>
			</svg>`
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
		{@html currentMode.icon}
		<span class="ml-2 hidden sm:inline">{currentMode.name}</span>
	</Button>
</div>
