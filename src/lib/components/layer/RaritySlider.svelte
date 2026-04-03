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

	const { rarityWeight, traitId, layerId }: Props = $props();
	const layerIdTyped = $derived(createLayerId(layerId));
	const traitIdTyped = $derived(createTraitId(traitId));

	// Helper to clamp and round rarity values
	const normalizeRarity = (val: number) => Math.max(1, Math.min(5, Math.round(val || 1)));

	// Internal primitive state for the rarity value - THE single source of truth
	let currentValue = $state(untrack(() => normalizeRarity(rarityWeight)));

	// Sync prop changes from outside (e.g. undo/redo, batch load)
	$effect(() => {
		const propVal = normalizeRarity(rarityWeight);
		if (currentValue !== propVal) {
			currentValue = propVal;
		}
	});

	// Handle slider value change
	function handleSliderChange(newValue: number) {
		const normalized = normalizeRarity(newValue);
		if (currentValue !== normalized) {
			currentValue = normalized;
			// Update store, but untrack rarityWeight to avoid feedback loops
			const propVal = untrack(() => normalizeRarity(rarityWeight));
			if (normalized !== propVal) {
				untrack(() => updateTraitRarity(layerIdTyped, traitIdTyped, normalized));
			}
		}
	}

	const rarityLabels: Record<number, string> = {
		1: 'Mythic',
		2: 'Legendary',
		3: 'Epic',
		4: 'Rare',
		5: 'Common'
	};

	// Derived label for the header - responds immediately to currentValue changes
	const currentLabel = $derived(rarityLabels[currentValue] || 'Unknown');
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
			class="bg-primary/10 text-primary border-primary/20 rounded-full border px-2 py-0.5 text-xs font-bold transition-all duration-200"
			data-testid="rarity-value"
		>
			{currentLabel}
		</span>
	</div>

	<div class="px-1">
		<Slider
			min={1}
			max={5}
			step={1}
			value={currentValue}
			onchange={handleSliderChange}
			class="w-full"
		/>
	</div>

	<div class="flex justify-between px-0.5">
		<div class="flex flex-col items-center">
			<div
				class="h-1 w-1 rounded-full transition-colors {currentValue === 1
					? 'bg-primary'
					: 'bg-muted-foreground/30'}"
			></div>
			<span class="text-muted-foreground/50 mt-1 text-[9px] tracking-tighter uppercase">Mythic</span
			>
		</div>
		<div class="flex flex-col items-center">
			<div
				class="h-1 w-1 rounded-full transition-colors {currentValue === 5
					? 'bg-primary'
					: 'bg-muted-foreground/30'}"
			></div>
			<span class="text-muted-foreground/50 mt-1 text-[9px] tracking-tighter uppercase">Common</span
			>
		</div>
	</div>
</div>
