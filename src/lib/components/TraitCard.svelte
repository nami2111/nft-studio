<script lang="ts">
	import type { Trait } from '$lib/types/trait';
	import RaritySlider from '$lib/components/RaritySlider.svelte';

	interface Props {
		trait: Trait;
		layerId: string;
	}

	let { trait, layerId }: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border border-gray-200">
	<div class="flex aspect-square items-center justify-center bg-gray-100">
		{#if trait.imageUrl}
			<img src={trait.imageUrl} alt={trait.name} class="h-full w-full object-contain" />
		{:else}
			<span class="text-gray-500">No image</span>
		{/if}
	</div>
	<div class="p-2">
		<p class="truncate text-sm font-medium text-gray-900">{trait.name}</p>
		<RaritySlider rarityWeight={trait.rarityWeight} traitId={trait.id} {layerId} />
	</div>
</div>
