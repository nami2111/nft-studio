<script lang="ts">
	import { updateTraitRarity } from '$lib/stores/runes-store';
	import { Slider } from '$lib/components/ui/slider';

	interface Props {
		rarityWeight: number;
		traitId: string;
		layerId: string;
	}

	const { rarityWeight, traitId, layerId }: Props = $props();
	// Ensure the initial value is valid (between 1 and 5)
	let clampedRarityWeight = Math.max(1, Math.min(5, Math.round(rarityWeight || 1)));
	let sliderValue = $state([clampedRarityWeight]);

	const rarityLabels: { [key: number]: string } = {
		1: 'Mythic',
		2: 'Legendary',
		3: 'Epic',
		4: 'Rare',
		5: 'Common'
	};

	$effect(() => {
		// This will run whenever sliderValue changes
		if (sliderValue && sliderValue.length > 0) {
			// Ensure the value is a valid integer between 1 and 5
			const validValue = Math.max(1, Math.min(5, Math.round(sliderValue[0] || 3)));
			// Only update if the value actually changed
			if (validValue !== sliderValue[0]) {
				sliderValue = [validValue];
			}
			updateTraitRarity(layerId, traitId, validValue);
		}
	});
</script>

<div class="mt-2">
	<label for="rarity-slider-{traitId}" class="block text-xs font-medium text-gray-700"
		>Rarity: <span class="font-bold text-indigo-600">{rarityLabels[sliderValue[0]]}</span></label
	>
	<div class="mt-1 flex items-center">
		<Slider min={1} max={5} step={1} bind:value={sliderValue} class="w-full" />
	</div>
	<div class="mt-1 flex justify-between text-xs text-gray-500">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>
