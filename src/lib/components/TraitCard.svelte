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
		selected?: boolean;
		onToggleSelection?: () => void;
		showSelection?: boolean;
	}

	const {
		trait,
		layerId,
		selected = false,
		onToggleSelection,
		showSelection = false
	}: Props = $props();
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
		// Simple confirmation dialog
		if (confirm(`Are you sure you want to delete "${trait.name}"?`)) {
			try {
				removeTrait(layerIdTyped, traitIdTyped);
				toast.success(`Trait "${trait.name}" has been deleted.`);
			} catch (error) {
				console.error('Failed to delete trait:', error);
				toast.error('Failed to delete trait. Please try again.');
			}
		}
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

	// Effect to create imageUrl from imageData when needed
	$effect(() => {
		if (isVisible && trait.imageData && trait.imageData.byteLength > 0 && !trait.imageUrl) {
			try {
				const blob = new Blob([trait.imageData], { type: 'image/png' });
				const url = URL.createObjectURL(blob);
				trait.imageUrl = url;
			} catch (error) {
				console.error('Failed to create image URL:', error);
			}
		}
	});

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

<Card class="relative overflow-hidden border-2 {selected ? 'ring-primary ring-2' : ''}">
	<div class="bg-muted flex aspect-square items-center justify-center" bind:this={imageContainer}>
		{#if showSelection}
			<div class="absolute top-2 left-2 z-10">
				<input
					type="checkbox"
					checked={selected}
					onchange={onToggleSelection}
					class="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300 focus:ring-offset-0"
					aria-label="Select trait"
				/>
			</div>
		{/if}
		<div class="absolute top-2 right-2 flex gap-1">
			<TraitTypeToggle {trait} {layerId} />
			{#if trait.type === 'ruler' && currentLayer && allLayers}
				<RulerRulesManager
					{trait}
					layer={currentLayer}
					{allLayers}
					onRulesUpdate={handleRulerRulesUpdate}
				/>
			{/if}
		</div>
		{#if isVisible}
			{#if trait.imageUrl && trait.imageData && trait.imageData.byteLength > 0}
				<img
					src={trait.imageUrl}
					alt={trait.name}
					class="h-full w-full object-contain"
					loading="lazy"
					onerror={(e) => {
						// If imageUrl fails, try to recreate from imageData
						if (trait.imageData && trait.imageData.byteLength > 0) {
							try {
								const blob = new Blob([trait.imageData], { type: 'image/png' });
								const newUrl = URL.createObjectURL(blob);
								(e.target as HTMLImageElement).src = newUrl;
								trait.imageUrl = newUrl;
							} catch (error) {
								console.error('Failed to recreate image URL:', error);
								// Show broken image state
								(e.target as HTMLImageElement).style.display = 'none';
							}
						} else {
							// Show broken image state
							(e.target as HTMLImageElement).style.display = 'none';
						}
					}}
				/>
			{:else if trait.imageData && trait.imageData.byteLength > 0}
				<!-- Has imageData but no imageUrl, $effect will create it -->
				<img
					src={trait.imageUrl}
					alt={trait.name}
					class="h-full w-full object-contain"
					loading="lazy"
					onerror={(e) => {
						console.error('Failed to create image from data:', e);
						(e.target as HTMLImageElement).style.display = 'none';
					}}
				/>
			{:else if trait.imageUrl && (!trait.imageData || trait.imageData.byteLength === 0)}
				<!-- Likely from persisted project - show needs re-upload indicator -->
				<div class="flex h-full flex-col items-center justify-center p-2 text-center">
					<div class="text-muted-foreground mb-2">
						<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<span class="text-muted-foreground text-xs">Image needs re-upload</span>
				</div>
			{:else}
				<div class="flex h-full items-center justify-center">
					<div
						class="border-muted-foreground border-t-foreground h-6 w-6 animate-spin rounded-full border-2"
					></div>
				</div>
			{/if}
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-muted-foreground text-xs">Loading...</div>
			</div>
		{/if}
	</div>
	<CardContent class="p-3">
		<div class="flex items-center justify-between">
			{#if isEditing}
				<input
					bind:value={traitName}
					class="border-foreground w-full border-b-2 bg-transparent text-sm font-medium focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && handleUpdateName()}
				/>
				<div class="flex">
					<Button variant="ghost" size="icon" onclick={handleUpdateName}
						><Check class="h-4 w-4" /></Button
					>
					<Button variant="ghost" size="icon" onclick={cancelEdit}><X class="h-4 w-4" /></Button>
				</div>
			{:else}
				<p class="text-card-foreground truncate text-sm font-medium" title={trait.name}>
					{trait.name}
				</p>
				<div class="flex gap-1">
					<Button variant="ghost" size="icon" onclick={() => (isEditing = true)}
						><Edit class="h-4 w-4" /></Button
					>
					<Button variant="ghost" size="icon" onclick={handleRemoveTrait}
						><Trash2 class="text-destructive h-4 w-4" /></Button
					>
				</div>
			{/if}
		</div>
		<RaritySlider rarityWeight={trait.rarityWeight} traitId={trait.id} {layerId} />
	</CardContent>
</Card>
