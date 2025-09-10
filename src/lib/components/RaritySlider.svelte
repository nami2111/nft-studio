<script lang="ts">
	import { updateTraitRarity } from '$lib/stores/runes-store';
	import { Slider } from '$lib/components/ui/slider';

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

	function handleRarityChange(value: number) {
		sliderValue = value;
		updateTraitRarity(layerId, traitId, value);
	}
</script>

<div class="mt-2">
	<label for="rarity-slider-{traitId}" class="block text-xs font-medium text-gray-700"
		>Rarity: <span class="font-bold text-indigo-600">{rarityLabels[sliderValue]}</span></label
	>
	<div class="mt-1 flex items-center">
		<Slider
			min={1}
			max={5}
			step={1}
			value={[sliderValue]}
			onValueChange={(value) => handleRarityChange(value[0])}
			class="w-full"
		/>
	</div>
	<div class="mt-1 flex justify-between text-xs text-gray-500">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>
