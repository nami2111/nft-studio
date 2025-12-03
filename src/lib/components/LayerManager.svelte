<script lang="ts">
	import { project, addLayer, reorderLayers } from '$lib/stores';
	import type { LayerId } from '$lib/types/ids';
	import LayerItem from '$lib/components/LayerItem.svelte';

	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import Loader2 from 'lucide-svelte/icons/loader-2';
	import { showError, showSuccess } from '$lib/utils/error-handling';

	let layers = $derived(project.layers);
	let isAddingLayer = $state(false);

	async function handleAddLayer() {
		if (isAddingLayer) return;
		isAddingLayer = true;

		try {
			const newLayerName = `Layer ${layers.length + 1}`;
			addLayer(newLayerName);
			showSuccess('Layer added successfully.');
		} catch (error) {
			console.error('Failed to add layer:', error);
			showError(error, {
				title: 'Layer Error',
				description: error instanceof Error ? error.message : 'Unknown error'
			});
		} finally {
			isAddingLayer = false;
		}
	}

	function moveLayer(layerId: LayerId, direction: 'up' | 'down') {
		const currentIndex = layers.findIndex((layer) => layer.id === layerId);
		if (currentIndex === -1) return;

		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if (newIndex < 0 || newIndex >= layers.length) return;

		const newLayers = [...layers];
		const [movedLayer] = newLayers.splice(currentIndex, 1);
		newLayers.splice(newIndex, 0, movedLayer);

		const layerIds = newLayers.map((layer) => layer.id);
		reorderLayers(layerIds);
		showSuccess('Layer moved successfully.');
	}
</script>

<Card class="mt-4 sm:mt-6">
	<CardContent class="p-4 sm:p-6">
		<div
			class="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 md:mb-4 lg:mb-6"
		>
			<h2 class="text-base font-bold sm:text-lg md:text-xl lg:text-2xl">
				Layers ({layers.length})
			</h2>
			<Button
				variant="outline"
				size="sm"
				onclick={handleAddLayer}
				disabled={isAddingLayer}
				class="w-full transition-all sm:w-auto"
			>
				{#if isAddingLayer}
					<Loader2 class="mr-1 h-3 w-3 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
					<span class="text-xs sm:text-sm">Adding...</span>
				{:else}
					<span class="text-xs sm:text-sm">Add Layer</span>
				{/if}
			</Button>
		</div>

		{#if layers.length === 0}
			<p class="text-muted-foreground text-center text-sm sm:text-base">
				No layers yet. Add one to get started!
			</p>
		{:else}
			<div class="space-y-3 sm:space-y-4">
				{#each layers as layer (layer.id)}
					<div class="group relative">
						<LayerItem {layer} />
						<div class="mt-2 flex justify-end gap-1">
							<Button
								variant="outline"
								size="sm"
								onclick={() => moveLayer(layer.id, 'up')}
								disabled={layers.indexOf(layer) === 0}
								class="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm"
							>
								<span class="hidden sm:inline">↑</span>
								<span class="sm:hidden">Up</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => moveLayer(layer.id, 'down')}
								disabled={layers.indexOf(layer) === layers.length - 1}
								class="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm"
							>
								<span class="hidden sm:inline">↓</span>
								<span class="sm:hidden">Down</span>
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
