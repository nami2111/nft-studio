<script lang="ts">
	import { updateTraitRarity } from '$lib/stores';
	import { Slider } from '$lib/components/ui/slider';
	import { createLayerId, createTraitId } from '$lib/types/ids';

	interface Props {
		rarityWeight: number;
		traitId: string;
		layerId: string;
	}

	const { rarityWeight, traitId, layerId }: Props = $props();
	const layerIdTyped = $derived(createLayerId(layerId));
	const traitIdTyped = $derived(createTraitId(traitId));

	// Derive the slider value from the prop
	let sliderValue = $derived([Math.max(1, Math.min(5, Math.round(rarityWeight || 1)))]);

	const rarityLabels: { [key: number]: string } = {
		1: 'Mythic',
		2: 'Legendary',
		3: 'Epic',
		4: 'Rare',
		5: 'Common'
	};

	// Handle slider change
	function handleSliderChange(newValue: number[]) {
		if (newValue && newValue.length > 0) {
			const currentVal = Math.max(1, Math.min(5, Math.round(newValue[0] || 3)));
			if (currentVal !== rarityWeight) {
				updateTraitRarity(layerIdTyped, traitIdTyped, currentVal);
			}
		}
	}
</script>

<div class="space-y-2" data-testid="rarity-slider" data-rarity={rarityWeight}>
	<div class="flex items-center justify-between">
		<label for="rarity-slider-{traitId}" class="text-sm font-medium"
			>Rarity: <span class="text-primary font-bold" data-testid="rarity-value"
				>{rarityLabels[sliderValue[0]]}</span
			></label
		>
	</div>
	<Slider
		min={1}
		max={5}
		step={1}
		value={sliderValue}
		onValueChange={handleSliderChange}
		class="w-full"
	/>
	<div class="text-muted-foreground flex justify-between text-xs">
		<span>Rare</span>
		<span>Common</span>
	</div>
</div>
