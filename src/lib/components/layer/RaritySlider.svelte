<script lang="ts">
	import { updateTraitRarity } from '$lib/stores';
	import { Slider } from '$lib/components/ui/slider';
	import { createLayerId, createTraitId } from '$lib/types/ids';
	import { untrack } from 'svelte';

	interface Props {
		rarityWeight: number;
		traitId: string;
		layerId: string;
	}

	let { rarityWeight, traitId, layerId }: Props = $props();
	const layerIdTyped = $derived(createLayerId(layerId));
	const traitIdTyped = $derived(createTraitId(traitId));

	// Helper to clamp and round rarity values
	const normalizeRarity = (val: number) => Math.max(1, Math.min(5, Math.round(val || 1)));

	// Local state for the slider, initialized from prop
	let sliderValue = $state([normalizeRarity(rarityWeight)]);

	const rarityLabels: Record<number, string> = {
		1: 'Mythic',
		2: 'Legendary',
		3: 'Epic',
		4: 'Rare',
		5: 'Common'
	};

	// Update store when slider changes
	$effect(() => {
		const val = sliderValue[0];
		// We only want to trigger this when sliderValue changes.
		// We untrack rarityWeight so we don't re-run when the prop we just updated comes back.
		const currentProp = untrack(() => normalizeRarity(rarityWeight));
		if (val !== undefined && val !== currentProp) {
			untrack(() => updateTraitRarity(layerIdTyped, traitIdTyped, val));
		}
	});

	// Sync local state if prop changes from outside
	$effect(() => {
		const propVal = normalizeRarity(rarityWeight);
		// We only want to trigger this when rarityWeight changes.
		// We untrack sliderValue so we don't re-run when we update the slider ourselves.
		if (untrack(() => normalizeRarity(sliderValue[0] ?? rarityWeight)) !== propVal) {
			sliderValue = [propVal];
		}
	});

	const currentLabel = $derived(
		rarityLabels[normalizeRarity(sliderValue[0] ?? rarityWeight)] || 'Unknown'
	);
</script>

<div class="space-y-3 py-1" data-testid="rarity-slider" data-rarity={rarityWeight}>
	<div class="flex items-center justify-between">
		<label
			for="rarity-slider-{traitId}"
			class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
		>
			Rarity
		</label>
		<span
			class="bg-primary/10 text-primary border-primary/20 rounded-full border px-2 py-0.5 text-xs font-bold"
			data-testid="rarity-value"
		>
			{currentLabel}
		</span>
	</div>

	<div class="px-1">
		<Slider min={1} max={5} step={1} bind:value={sliderValue} class="w-full" />
	</div>

	<div class="flex justify-between px-0.5">
		<div class="flex flex-col items-center">
			<div
				class="h-1 w-1 rounded-full {sliderValue[0] === 1
					? 'bg-primary'
					: 'bg-muted-foreground/30'}"
			></div>
			<span class="text-muted-foreground/50 mt-1 text-[9px]">Mythic</span>
		</div>
		<div class="flex flex-col items-center">
			<div
				class="h-1 w-1 rounded-full {sliderValue[0] === 5
					? 'bg-primary'
					: 'bg-muted-foreground/30'}"
			></div>
			<span class="text-muted-foreground/50 mt-1 text-[9px]">Common</span>
		</div>
	</div>
</div>
