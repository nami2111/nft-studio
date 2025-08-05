<script lang="ts">
	import { updateTraitRarity } from '$lib/stores/project.store';

	interface Props {
		rarityWeight: number;
		traitId: string;
		layerId: string;
	}

	let { rarityWeight, traitId, layerId }: Props = $props();

	function handleRarityChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const newRarity = parseInt(target.value);
		updateTraitRarity(layerId, traitId, newRarity);
	}
</script>

<div class="mt-2">
	<label class="block text-xs font-medium text-gray-700">Rarity</label>
	<div class="flex items-center mt-1">
		<input
			type="range"
			min="1"
			max="5"
			class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			value={rarityWeight}
			on:input={handleRarityChange}
		/>
		<span class="ml-2 text-xs text-gray-500 w-4">{rarityWeight}</span>
	</div>
	<div class="flex justify-between text-xs text-gray-500 mt-1">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>