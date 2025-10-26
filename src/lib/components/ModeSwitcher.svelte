<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const modes = [
		{ name: 'Generate Mode', route: '/app', icon: '🎨' },
		{ name: 'Gallery Mode', route: '/app/gallery', icon: '🖼️' }
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
		<span class="text-lg">{currentMode.icon}</span>
		<span class="hidden sm:inline ml-2">{currentMode.name}</span>
	</Button>
</div>
