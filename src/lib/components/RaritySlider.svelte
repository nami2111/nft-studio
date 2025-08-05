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
	<label class="block text-xs font-medium text-gray-700" for="rarity-{traitId}">Rarity</label>
	<div class="mt-1 flex items-center">
		<input
			id="rarity-{traitId}"
			type="range"
			min="1"
			max="5"
			class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			value={rarityWeight}
			oninput={handleRarityChange}
		/>
		<span class="ml-2 w-4 text-xs text-gray-500">{rarityWeight}</span>
	</div>
	<div class="mt-1 flex justify-between text-xs text-gray-500">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>
