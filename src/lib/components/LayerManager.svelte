<script lang="ts">
	import { project, addLayer, reorderLayers } from '$lib/stores/runes-store';
	import LayerItem from '$lib/components/LayerItem.svelte';
	import { flip } from 'svelte/animate';
	import { dndzone } from 'svelte-dnd-action';
	import type { Layer } from '$lib/types/layer';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Loader2, GripVertical } from 'lucide-svelte';

	let layers = $derived($project.layers);
	let isAddingLayer = $state(false);
	let dndError = $state(false);

	// Initialize drag and drop and catch any initialization errors
	$effect(() => {
		try {
			// The dndzone is automatically initialized when used in the template
			// We'll catch errors in the template rendering instead
		} catch (error) {
			console.error('Failed to initialize drag and drop:', error);
			dndError = true;
		}
	});

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

	function handleDndConsider(_e: CustomEvent) {
		// Handle consider event if needed
	}

	function handleDndFinalize(e: CustomEvent) {
		try {
			const { items: newItems } = e.detail;
			const reordered = newItems.map((layer: Layer, index: number) => ({
				...layer,
				order: index
			}));
			reorderLayers(reordered);
		} catch (error) {
			console.error('Error during drag and drop finalize:', error);
			dndError = true;
			// Show user-friendly error message
			import('svelte-sonner').then(({ toast }) => {
				toast.error('Drag and drop error', {
					description: 'Failed to reorder layers. Please try again.'
				});
			});
		}
	}

	// Fallback function to move a layer up or down
	function moveLayer(layerId: string, direction: 'up' | 'down') {
		const currentIndex = layers.findIndex((layer) => layer.id === layerId);
		if (currentIndex === -1) return;

		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if (newIndex < 0 || newIndex >= layers.length) return;

		const newLayers = [...layers];
		const [movedLayer] = newLayers.splice(currentIndex, 1);
		newLayers.splice(newIndex, 0, movedLayer);

		const reordered = newLayers.map((layer, index) => ({
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
			{#if dndError}
				<div class="mb-4 rounded-md bg-yellow-50 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<span class="text-yellow-400">⚠️</span>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-yellow-800">Drag and Drop Disabled</h3>
							<div class="mt-2 text-sm text-yellow-700">
								<p>
									Drag and drop functionality is currently disabled due to compatibility issues. Use
									the arrow buttons to reorder layers.
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}
			<div
				class="space-y-4"
				use:dndzone={{
					items: layers,
					flipDurationMs: 150,
					dragDisabled: dndError
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each layers as layer (layer.id)}
					<div animate:flip={{ duration: 150 }} class="group relative">
						{#if !dndError}
							<div
								class="absolute top-1/2 left-0 -translate-y-1/2 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
							>
								<GripVertical class="h-4 w-4 text-gray-400" />
							</div>
						{/if}
						<LayerItem {layer} />
						{#if dndError}
							<div class="mt-2 flex justify-end space-x-1">
								<Button
									variant="outline"
									size="sm"
									onclick={() => moveLayer(layer.id, 'up')}
									disabled={layers.indexOf(layer) === 0}
								>
									↑
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => moveLayer(layer.id, 'down')}
									disabled={layers.indexOf(layer) === layers.length - 1}
								>
									↓
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
