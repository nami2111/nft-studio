<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { Trait } from '$lib/types/trait';
	import RaritySlider from '$lib/components/RaritySlider.svelte';
	import { removeTrait, updateTraitName } from '$lib/stores/runes-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Edit, Trash2, Check, X } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		trait: Trait;
		layerId: string;
	}

	const { trait, layerId }: Props = $props();

	let traitName = $derived(trait.name);
	let isEditing = $state(false);
	let isVisible = $state(false);
	let observer: IntersectionObserver | null = $state(null);

	function handleRemoveTrait() {
		toast.warning(`Are you sure you want to delete "${trait.name}"?`, {
			action: {
				label: 'Delete',
				onClick: () => {
					removeTrait(layerId, trait.id);
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

		updateTraitName(layerId, trait.id, traitName);
		toast.success('Trait name updated.');
		isEditing = false;
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
				<p class="truncate text-sm font-medium text-gray-900" title={trait.name}>{trait.name}</p>
				<div class="flex">
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
