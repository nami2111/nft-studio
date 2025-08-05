<script lang="ts">
	import { project, addLayer, reorderLayers } from '$lib/stores/project.store';
	import LayerItem from '$lib/components/LayerItem.svelte';
	import { flip } from 'svelte/animate';
	import { dragAndDrop } from 'svelte-dnd-action';
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

<div class="bg-white shadow rounded-lg p-6 mt-6">
	<div class="flex justify-between items-center mb-4">
		<h2 class="text-xl font-bold text-gray-800">Layers</h2>
		<button
			type="button"
			class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			on:click={handleAddLayer}
		>
			Add Layer
		</button>
	</div>
	
	<div 
		class="space-y-4"
		use:dragAndDrop={{
			items: layers,
			animation: flip
		}}
		on:consider={handleDndConsider}
		on:finalize={handleDndFinalize}
	>
		{#each layers as layer (layer.id)}
			<LayerItem {layer} />
		{/each}
	</div>
</div>