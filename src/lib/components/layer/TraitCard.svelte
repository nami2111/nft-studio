<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import type { Trait } from '$lib/types/layer';
	import RaritySlider from '$lib/components/layer/RaritySlider.svelte';
	import { useProjectStore } from '$lib/stores/facades';
	import { createLayerId, createTraitId } from '$lib/types/ids';
	import { Button, flatIconButtonClass } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import Icon from '$components/shared/Icon.svelte';
	import { Edit02Icon, Delete02Icon, CheckmarkBadge01Icon, Cancel01Icon, AlertDiamondIcon } from '@hugeicons/core-free-icons';
	import { onMount, onDestroy, untrack } from 'svelte';
	import RulerRulesManager from '$lib/components/ui/ruler/RulerRulesManager.svelte';
	import TraitTypeToggle from '$lib/components/ui/ruler/TraitTypeToggle.svelte';

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

	const projectStore = useProjectStore();
	const layerIdTyped = $derived(createLayerId(layerId));
	const traitIdTyped = $derived(createTraitId(trait.id));

	let editedName = $state(''); // Only used during editing
	let isEditing = $state(false);
	let isVisible = $state(false);
	let isLoaded = $state(false);
	let observer: IntersectionObserver | null = $state(null);

	// Get current layer and all layers for ruler rules manager
	const currentLayer = $derived(projectStore.state.layers.find((l) => l.id === layerIdTyped));
	const allLayers = $derived(projectStore.state.layers);

	function handleRemoveTrait() {
		// Simple confirmation dialog
		if (confirm(`Are you sure you want to delete "${trait.name}"?`)) {
			try {
				projectStore.actions.removeTrait(layerIdTyped, traitIdTyped);
				toast.success(`Trait "${trait.name}" has been deleted.`);
			} catch (error) {
				console.error('Failed to delete trait:', error);
				toast.error('Failed to delete trait. Please try again.');
			}
		}
	}

	function handleUpdateName() {
		if (editedName.trim() === '') {
			toast.error('Trait name cannot be empty.');
			isEditing = false;
			return;
		}

		if (editedName.length > 100) {
			toast.error('Trait name cannot exceed 100 characters.');
			isEditing = false;
			return;
		}

		projectStore.actions.updateTraitName(layerIdTyped, traitIdTyped, editedName);
		toast.success('Trait name updated.');
		isEditing = false;
	}

	// Handle ruler rules update
	function handleRulerRulesUpdate(rules: import('$lib/types/layer').RulerRule[]) {
		projectStore.actions.updateTraitRulerRules(layerIdTyped, traitIdTyped, rules);
	}

	function cancelEdit() {
		isEditing = false;
	}

	function startEditing() {
		editedName = trait.name;
		isEditing = true;
	}

	let imageContainer: HTMLElement;

	// Effect to create imageUrl from imageData when needed
	$effect(() => {
		if (isVisible && trait.imageData && trait.imageData.byteLength > 0 && !trait.imageUrl) {
			try {
				const blob = new Blob([trait.imageData], { type: 'image/png' });
				const url = URL.createObjectURL(blob);
				untrack(() => {
					trait.imageUrl = url;
				});
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
					}
				});
			},
			{
				rootMargin: '50px',
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

		// ObjectURL cleanup is handled by the global resource manager
	});
</script>

<Card
	class="relative overflow-hidden {selected ? 'ring-primary ring-2' : ''}"
	data-testid="trait-card"
>
	<div class="bg-muted flex aspect-square items-center justify-center" bind:this={imageContainer}>
		{#if showSelection}
			<div class="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center">
				<Checkbox
					checked={selected}
					onchange={() => onToggleSelection?.()}
					aria-label="Select trait"
					data-testid="trait-select-checkbox"
				/>
			</div>
		{/if}
		<div class="absolute top-2 right-2 z-10 flex h-8 items-center justify-center gap-1">
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
		<div
			class="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900"
		>
			{#if isVisible}
				{#if trait.imageUrl && trait.imageData && trait.imageData.byteLength > 0}
					<img
						src={trait.imageUrl}
						alt={trait.name}
						class="h-full w-full object-contain transition-opacity duration-500 {isLoaded
							? 'opacity-100'
							: 'opacity-0'}"
						loading="lazy"
						data-testid="trait-image"
						onload={() => (isLoaded = true)}
						onerror={(e) => {
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
					{#if !isLoaded}
						<div
							class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-800"
							data-testid="skeleton-loader"
						>
							<div
								class="h-full w-full -translate-x-full animate-[shimmer_2s_infinite] bg-linear-to-r from-transparent via-white/20 to-transparent"
							></div>
						</div>
					{/if}
				{:else if trait.imageData && trait.imageData.byteLength > 0}
					<!-- Has imageData but no imageUrl, $effect will create it -->
					<img
						src={trait.imageUrl}
						alt={trait.name}
						class="h-full w-full object-contain transition-opacity duration-500 {isLoaded
							? 'opacity-100'
							: 'opacity-0'}"
						loading="lazy"
						data-testid="trait-image"
						onload={() => (isLoaded = true)}
						onerror={(e) => {
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
					{#if !isLoaded}
						<div
							class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-800"
							data-testid="skeleton-loader"
						></div>
					{/if}
				{:else if trait.imageUrl && (!trait.imageData || trait.imageData.byteLength === 0)}
					<!-- Likely from persisted project - show needs re-upload indicator -->
					<div
						class="flex h-full flex-col items-center justify-center p-4 text-center"
						data-testid="reupload-indicator"
					>
						<div class="mb-2 rounded-full bg-amber-50 p-2 text-amber-500 dark:bg-amber-950/30">
							<Icon icon={AlertDiamondIcon} class="h-6 w-6" />
						</div>
						<span class="text-[10px] font-medium text-amber-600 dark:text-amber-400"
							>Source image missing</span
						>
						<p class="mt-1 text-[9px] text-gray-400">Please re-upload this file.</p>
					</div>
				{:else}
					<div
						class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-800"
						data-testid="skeleton-loader"
					></div>
				{/if}
			{:else}
				<div
					class="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-800"
					data-testid="skeleton-loader"
				></div>
			{/if}
		</div>
	</div>
	<CardContent class="p-3" data-testid="card-content">
		<div class="flex items-center justify-between">
			{#if isEditing}
				<Input
					bind:value={editedName}
					class="h-8 border-b-2 bg-transparent text-sm font-medium focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && handleUpdateName()}
					data-testid="trait-name-input"
				/>
				<div class="flex">
					<Button
						variant="ghost"
						size="icon"
						onclick={handleUpdateName}
						class={flatIconButtonClass}
						data-testid="save-button"
						><Icon icon={CheckmarkBadge01Icon} class="h-4 w-4" /></Button
					><Button
						variant="ghost"
						size="icon"
						onclick={cancelEdit}
						class={flatIconButtonClass}
						data-testid="cancel-button"
					><Icon icon={Cancel01Icon} class="h-4 w-4" /></Button
					>
				</div>
			{:else}
				<p class="text-card-foreground truncate text-sm font-medium" title={trait.name}>
					{trait.name}
				</p>
				<div class="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						onclick={startEditing}
						class={flatIconButtonClass}
						data-testid="edit-button"
						><Icon icon={Edit02Icon} class="h-4 w-4" /></Button
					>
					<Button
						variant="ghost"
						size="icon"
						onclick={handleRemoveTrait}
						class={flatIconButtonClass}
						data-testid="delete-button"><Icon icon={Delete02Icon} class="text-destructive h-4 w-4" /></Button
					>
				</div>
			{/if}
		</div>
		<RaritySlider rarityWeight={trait.rarityWeight} traitId={trait.id} {layerId} />
	</CardContent>
</Card>

<style>
	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}
</style>
