<script lang="ts">
	import type { Trait } from '$lib/types/trait';
	import RaritySlider from '$lib/components/RaritySlider.svelte';

	interface Props {
		trait: Trait;
		layerId: string;
	}

	let { trait, layerId }: Props = $props();
</script>

<div class="border border-gray-200 rounded-lg overflow-hidden">
	<div class="aspect-square bg-gray-100 flex items-center justify-center">
		{#if trait.imageUrl}
			<img 
				src={trait.imageUrl} 
				alt={trait.name}
				class="object-contain w-full h-full"
			/>
		{:else}
			<span class="text-gray-500">No image</span>
		{/if}
	</div>
	<div class="p-2">
		<p class="text-sm font-medium text-gray-900 truncate">{trait.name}</p>
		<RaritySlider rarityWeight={trait.rarityWeight} traitId={trait.id} layerId={layerId} />
	</div>
</div>