<script lang="ts">
	import { project, addLayer, reorderLayers } from '$lib/stores/project.store';
	import LayerItem from '$lib/components/LayerItem.svelte';
	import { flip } from 'svelte/animate';
	import { dndzone } from 'svelte-dnd-action';
	import type { Layer } from '$lib/types/layer';

	let layers = $state<Layer[]>([]);

	// Subscribe to store changes
	project.subscribe((p) => {
		layers = p.layers;
	});

	function handleAddLayer() {
		const newLayerName = `Layer ${layers.length + 1}`;
		addLayer({
			name: newLayerName,
			order: layers.length
		});
	}

	function handleDndConsider(e: CustomEvent) {
		// Handle drag and drop preview
	}

	function handleDndFinalize(e: CustomEvent) {
		const { items: newItems } = e.detail;
		// Update the order of layers based on the new order
		const reorderedLayers = newItems.map((layer: Layer, index: number) => ({
			...layer,
			order: index
		}));
		reorderLayers(reorderedLayers);
	}
</script>

<div class="mt-6 rounded-lg bg-white p-6 shadow">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold text-gray-800">Layers</h2>
		<button
			type="button"
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm leading-4 font-medium text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
			onclick={handleAddLayer}
		>
			Add Layer
		</button>
	</div>

	<div
		class="space-y-4"
		use:dndzone={{
			items: layers,
			flipDurationMs: 150
		}}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each layers as layer (layer.id)}
			<LayerItem {layer} />
		{/each}
	</div>
</div>
