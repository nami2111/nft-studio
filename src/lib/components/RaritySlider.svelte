<script lang="ts">
	import { traitsStore } from '$lib/stores';

	interface Props {
		rarityWeight: number;
		traitId: string;
		layerId: string;
	}

	const { rarityWeight, traitId, layerId }: Props = $props();
	let sliderValue = $state(rarityWeight);

	const rarityLabels: { [key: number]: string } = {
		1: 'Mythic',
		2: 'Legendary',
		3: 'Epic',
		4: 'Rare',
		5: 'Common'
	};

	function handleRarityChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const newRarity = parseInt(target.value);
		sliderValue = newRarity;
		traitsStore.updateTraitRarity(layerId, traitId, newRarity);
	}
</script>

<div class="mt-2">
	<label class="block text-xs font-medium text-gray-700" for="rarity-{traitId}"
		>Rarity: <span class="font-bold text-indigo-600">{rarityLabels[sliderValue]}</span></label
	>
	<div class="mt-1 flex items-center">
		<input
			id="rarity-{traitId}"
			type="range"
			min="1"
			max="5"
			step="1"
			class="thumb:bg-indigo-600 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
			bind:value={sliderValue}
			oninput={handleRarityChange}
			title={`Rarity: ${rarityLabels[sliderValue]} (${sliderValue})`}
		/>
	</div>
	<div class="mt-1 flex justify-between text-xs text-gray-500">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>
