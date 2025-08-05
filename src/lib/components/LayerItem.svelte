<script lang="ts">
	import type { Layer } from '$lib/types/layer';
	import TraitCard from '$lib/components/TraitCard.svelte';
	import { project, removeLayer, updateLayerName, addTrait } from '$lib/stores/project.store';
	import { untrack } from 'svelte';

	interface Props {
		layer: Layer;
	}

	let { layer }: Props = $props();
	let layerName = $state(layer.name);

	// Update local state when layer prop changes
	$effect(() => {
		layerName = layer.name;
	});

	function handleNameInput(e: Event) {
		const target = e.target as HTMLInputElement;
		layerName = target.value;
		updateLayerName(layer.id, target.value);
	}

	function handleDeleteLayer() {
		removeLayer(layer.id);
	}

	function handleFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		
		if (files && files.length > 0) {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (file.type.startsWith('image/')) {
					const imageUrl = URL.createObjectURL(file);
					addTrait(layer.id, {
						name: file.name,
						imageUrl,
						imageData: file,
						rarityWeight: 3 // Default rarity
					});
				}
			}
			// Reset the file input
			target.value = '';
		}
	}
</script>

<div class="border border-gray-200 rounded-lg p-4">
	<div class="flex justify-between items-center mb-3">
		<input
			type="text"
			class="text-lg font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
			value={layerName}
			on:input={handleNameInput}
		/>
		<div class="flex space-x-2">
			<button
				type="button"
				class="text-sm text-indigo-600 hover:text-indigo-900"
			>
				Edit
			</button>
			<button
				type="button"
				class="text-sm text-red-600 hover:text-red-900"
				on:click={handleDeleteLayer}
			>
				Delete
			</button>
		</div>
	</div>
	
	<div class="mb-4">
		<label class="block text-sm font-medium text-gray-700 mb-1">Upload Traits</label>
		<div class="flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 rounded-md">
			<div class="space-y-1 text-center">
				<svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
					<path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<div class="flex text-sm text-gray-600">
					<label for="file-upload-{layer.id}" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
						<span>Upload files</span>
						<input 
							id="file-upload-{layer.id}" 
							name="file-upload" 
							type="file" 
							class="sr-only" 
							multiple 
							accept="image/*" 
							on:change={handleFileUpload}
						/>
					</label>
					<p class="pl-1">or drag and drop</p>
				</div>
				<p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
			</div>
		</div>
	</div>
	
	<div class="mt-4">
		<h4 class="text-md font-medium text-gray-700 mb-2">Traits</h4>
		{#if layer.traits.length > 0}
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
				{#each layer.traits as trait (trait.id)}
					<TraitCard {trait} layerId={layer.id} />
				{/each}
			</div>
		{:else}
			<p class="text-gray-500 text-sm">No traits added yet</p>
		{/if}
	</div>
</div>