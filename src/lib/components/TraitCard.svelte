<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { Trait } from '$lib/types/layer';
	import RaritySlider from '$lib/components/RaritySlider.svelte';
	import { removeTrait, updateTraitName } from '$lib/stores';
	import { createLayerId, createTraitId } from '$lib/types/ids';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Edit, Trash2, Check, X, Crown } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import RulerRulesManager from '$lib/components/ui/ruler/RulerRulesManager.svelte';
	import TraitTypeToggle from '$lib/components/ui/ruler/TraitTypeToggle.svelte';
	import { project } from '$lib/stores';

	interface Props {
		trait: Trait;
		layerId: string;
	}

	const { trait, layerId }: Props = $props();
	const layerIdTyped = createLayerId(layerId);
	const traitIdTyped = createTraitId(trait.id);

	let traitName = $derived(trait.name);
	let isEditing = $state(false);
	let isVisible = $state(false);
	let observer: IntersectionObserver | null = $state(null);

	// Get current layer and all layers for ruler rules manager
	let currentLayer = $derived(project.layers.find((l) => l.id === layerIdTyped));
	let allLayers = $derived(project.layers);

	function handleRemoveTrait() {
		toast.warning(`Are you sure you want to delete "${trait.name}"?`, {
			action: {
				label: 'Delete',
				onClick: () => {
					removeTrait(layerIdTyped, traitIdTyped);
					toast.success(`Trait "${trait.name}" has been deleted.`);
				}
			},
			cancel: {
				label: 'Cancel',
				onClick: () => {}
			}
		});
	}

	function handleUpdateName() {
		if (traitName.trim() === '') {
			toast.error('Trait name cannot be empty.');
			traitName = trait.name; // Revert
			return;
		}

		if (traitName.length > 100) {
			toast.error('Trait name cannot exceed 100 characters.');
			traitName = trait.name; // Revert
			return;
		}

		updateTraitName(layerIdTyped, traitIdTyped, traitName);
		toast.success('Trait name updated.');
		isEditing = false;
	}

	// Handle ruler rules update
	function handleRulerRulesUpdate(rules: import('$lib/types/layer').RulerRule[]) {
		if (!currentLayer) return;

		const traitIndex = currentLayer.traits.findIndex((t) => t.id === traitIdTyped);
		if (traitIndex !== -1) {
			currentLayer.traits[traitIndex].rulerRules = rules;
		}
	}

	function cancelEdit() {
		traitName = trait.name;
		isEditing = false;
	}

	let imageContainer: HTMLElement;

	onMount(() => {
		if (!imageContainer) return;

		// Set up Intersection Observer for lazy loading
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						// Disconnect observer once image is loaded
						if (observer) {
							observer.disconnect();
							observer = null;
						}
					}
				});
			},
			{
				rootMargin: '50px', // Start loading 50px before entering viewport
				threshold: 0.1
			}
		);

		observer.observe(imageContainer);
	});

	onDestroy(() => {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
	});
</script>

<Card class="overflow-hidden">
	<div
		class="flex aspect-square items-center justify-center bg-gray-100"
		bind:this={imageContainer}
	>
		{#if isVisible && trait.imageUrl}
			<img
				src={trait.imageUrl}
				alt={trait.name}
				class="h-full w-full object-contain"
				loading="lazy"
			/>
		{:else if !trait.imageUrl}
			<div class="flex h-full items-center justify-center">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"
				></div>
			</div>
		{:else}
			<span class="text-gray-500">No image</span>
		{/if}
	</div>
	<CardContent class="p-2">
		<div class="flex items-center justify-between">
			{#if isEditing}
				<input
					bind:value={traitName}
					class="w-full border-b bg-transparent text-sm font-medium focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && handleUpdateName()}
				/>
				<div class="flex">
					<Button variant="ghost" size="icon" onclick={handleUpdateName}
						><Check class="h-4 w-4" /></Button
					>
					<Button variant="ghost" size="icon" onclick={cancelEdit}><X class="h-4 w-4" /></Button>
				</div>
			{:else}
				<div class="flex min-w-0 items-center gap-2">
					{#if trait.type === 'ruler'}
						<div class="h-3 w-3 flex-shrink-0" title="Ruler Trait">
							<Crown class="h-3 w-3 text-yellow-500" />
						</div>
					{/if}
					<p class="truncate text-sm font-medium text-gray-900" title={trait.name}>{trait.name}</p>
				</div>
				<div class="flex gap-1">
					<TraitTypeToggle {trait} {layerId} />
					{#if trait.type === 'ruler' && currentLayer && allLayers}
						<RulerRulesManager
							{trait}
							layer={currentLayer}
							{allLayers}
							onRulesUpdate={handleRulerRulesUpdate}
						/>
					{/if}
					<Button variant="ghost" size="icon" onclick={() => (isEditing = true)}
						><Edit class="h-4 w-4" /></Button
					>
					<Button variant="ghost" size="icon" onclick={handleRemoveTrait}
						><Trash2 class="h-4 w-4 text-red-500" /></Button
					>
				</div>
			{/if}
		</div>
		<RaritySlider rarityWeight={trait.rarityWeight} traitId={trait.id} {layerId} />
	</CardContent>
</Card>
