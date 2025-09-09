<script lang="ts">
	import { project, addLayer, reorderLayers } from '$lib/stores/runes-store';
	import LayerItem from '$lib/components/LayerItem.svelte';
	import { flip } from 'svelte/animate';
	import { dndzone } from 'svelte-dnd-action';
	import type { Layer } from '$lib/types/layer';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Loader2 } from 'lucide-svelte';

	let layers = $derived($project.layers);
	let isAddingLayer = $state(false);

	async function handleAddLayer() {
		if (isAddingLayer) return;
		isAddingLayer = true;

		try {
			const newLayerName = `Layer ${layers.length + 1}`;
			addLayer({
				name: newLayerName,
				order: layers.length
			});
		} catch (error) {
			console.error('Failed to add layer:', error);
			// Show user-friendly error message
			import('svelte-sonner').then(({ toast }) => {
				toast.error('Failed to add layer', {
					description: error instanceof Error ? error.message : 'Unknown error'
				});
			});
		} finally {
			isAddingLayer = false;
		}
	}

	function handleDndFinalize(e: CustomEvent) {
		const { items: newItems } = e.detail;
		const reordered = newItems.map((layer: Layer, index: number) => ({
			...layer,
			order: index
		}));
		reorderLayers(reordered);
	}
</script>

<Card class="mt-6">
	<CardContent class="p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-bold text-gray-800">Layers ({layers.length})</h2>
			<Button onclick={handleAddLayer} disabled={isAddingLayer}>
				{#if isAddingLayer}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Adding...
				{:else}
					Add Layer
				{/if}
			</Button>
		</div>

		{#if layers.length === 0}
			<p class="text-center text-gray-500">No layers yet. Add one to get started!</p>
		{:else}
			<div
				class="space-y-4"
				use:dndzone={{
					items: layers,
					flipDurationMs: 150
				}}
				onconsider={() => {}}
				onfinalize={handleDndFinalize}
			>
				{#each layers as layer (layer.id)}
					<div animate:flip={{ duration: 150 }}>
						<LayerItem {layer} />
					</div>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
