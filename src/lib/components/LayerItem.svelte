<script lang="ts">
	import type { Layer } from '$lib/types/layer';
	import TraitCard from '$lib/components/TraitCard.svelte';
	import { removeLayer, updateLayerName, addTrait } from '$lib/stores/project.store';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Loader2, Trash2, Edit, Check, X, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { getImageDimensions } from '$lib/utils';

	interface Props {
		layer: Layer;
	}

	const { layer }: Props = $props();

	let layerName = $derived(layer.name);
	let isUploading = $state(false);
	let isEditing = $state(false);
	let isDragover = $state(false);
	let isExpanded = $state(true);

	function handleNameChange() {
		if (layerName.trim() === '') {
			toast.error('Layer name cannot be empty.');
			layerName = layer.name; // Revert to original name
		} else {
			updateLayerName(layer.id, layerName);
		}
		isEditing = false;
	}

	function cancelEdit() {
		layerName = layer.name;
		isEditing = false;
	}

	function handleDeleteLayer() {
		toast.info(`Layer "${layer.name}" has been removed.`, {
			action: {
				label: 'Undo',
				onClick: () => {
					console.log('Undo remove layer'); /* Add undo logic here */
				}
			}
		});
		removeLayer(layer.id);
	}

	async function handleFileUpload(files: FileList | null) {
		if (!files || files.length === 0) return;

		isUploading = true;
		isDragover = false;

		try {
			const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
			if (imageFiles.length === 0) {
				toast.warning('No valid image files were selected.');
				return;
			}

			// Limit batch size to prevent UI freezing
			const BATCH_SIZE = 10;
			let successCount = 0;
			let errorCount = 0;

			for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
				const batch = imageFiles.slice(i, i + BATCH_SIZE);

				// Process batch in parallel
				const batchPromises = batch.map(async (file) => {
					try {
						// Validate file size (max 10MB)
						if (file.size > 10 * 1024 * 1024) {
							throw new Error(`File "${file.name}" is too large (max 10MB)`);
						}

						const imageUrl = URL.createObjectURL(file);
						const dimensions = await getImageDimensions(file);
						await addTrait(layer.id, {
							name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
							imageUrl,
							imageData: file,
							width: dimensions.width,
							height: dimensions.height,
							rarityWeight: 3
						});
						return true;
					} catch (error) {
						console.error(`Error processing file ${file.name}:`, error);
						return false;
					}
				});

				const batchResults = await Promise.all(batchPromises);
				successCount += batchResults.filter(Boolean).length;
				errorCount += batchResults.filter((r) => !r).length;

				// Allow UI to update between batches
				if (i + BATCH_SIZE < imageFiles.length) {
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
			}

			if (errorCount === 0) {
				toast.success(`${successCount} trait(s) added successfully.`);
			} else if (successCount > 0) {
				toast.warning(`${successCount} trait(s) added, ${errorCount} failed.`);
			} else {
				toast.error('All files failed to upload. Please check the files and try again.');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'An unknown error occurred.';
			toast.error(`Error uploading files: ${message}`);
		} finally {
			isUploading = false;
		}
	}
</script>

<div class="rounded-lg border border-gray-200 p-4">
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center space-x-2">
			<Button variant="ghost" size="icon" onclick={() => (isExpanded = !isExpanded)}>
				{#if isExpanded}
					<ChevronDown class="h-4 w-4" />
				{:else}
					<ChevronRight class="h-4 w-4" />
				{/if}
			</Button>
			{#if isEditing}
				<input
					type="text"
					class="border-b border-indigo-500 bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
					bind:value={layerName}
					onchange={handleNameChange}
					onkeydown={(e) => e.key === 'Enter' && handleNameChange()}
				/>
			{:else}
				<h3 class="text-lg font-medium text-gray-900">{layer.name}</h3>
			{/if}
		</div>
		{#if !isEditing}
			<div class="flex space-x-1">
				<Button variant="ghost" size="icon" onclick={() => (isEditing = true)}
					><Edit class="h-4 w-4" /></Button
				>
				<Button variant="ghost" size="icon" onclick={handleDeleteLayer}
					><Trash2 class="h-4 w-4 text-red-500" /></Button
				>
			</div>
		{:else}
			<div class="flex space-x-1">
				<Button variant="ghost" size="icon" onclick={handleNameChange}
					><Check class="h-4 w-4" /></Button
				>
				<Button variant="ghost" size="icon" onclick={cancelEdit}><X class="h-4 w-4" /></Button>
			</div>
		{/if}
	</div>

	{#if isExpanded}
		<div class="mb-4">
			<label class="mb-1 block text-sm font-medium text-gray-700" for="file-upload-{layer.id}"
				>Upload Traits</label
			>
			<div
				class="flex justify-center rounded-md border-2 border-dashed px-6 pt-5 pb-6 transition-colors {isDragover
					? 'border-indigo-600 bg-indigo-50'
					: 'border-gray-300'}"
				ondragover={(e) => {
					e.preventDefault();
					isDragover = true;
				}}
				ondragleave={(e) => {
					e.preventDefault();
					isDragover = false;
				}}
				ondrop={(e) => {
					e.preventDefault();
					handleFileUpload(e.dataTransfer?.files ?? null);
				}}
				role="button"
				tabindex="0"
			>
				<div class="space-y-1 text-center">
					{#if isUploading}
						<Loader2 class="mx-auto h-12 w-12 animate-spin text-indigo-600" />
						<p class="mt-2 text-sm text-gray-600">Uploading files...</p>
					{:else}
						<svg
							class="mx-auto h-12 w-12 text-gray-400"
							stroke="currentColor"
							fill="none"
							viewBox="0 0 48 48"
							aria-hidden="true"
						>
							<path
								d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<div class="flex text-sm text-gray-600">
							<label
								for="file-upload-{layer.id}"
								class="relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500"
							>
								<span>Upload files</span>
								<input
									id="file-upload-{layer.id}"
									type="file"
									class="sr-only"
									multiple
									accept="image/*"
									onchange={(e) => handleFileUpload(e.currentTarget.files)}
								/>
							</label>
							<p class="pl-1">or drag and drop</p>
						</div>
						<p class="text-xs text-gray-500">PNG, JPG, GIF, etc.</p>
					{/if}
				</div>
			</div>
		</div>
		<div class="mt-4">
			<h4 class="text-md mb-2 font-medium text-gray-700">Traits ({layer.traits.length})</h4>
			{#if layer.traits.length > 0}
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
					{#each layer.traits as trait (trait.id)}
						<TraitCard {trait} layerId={layer.id} />
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500">No traits added yet. Upload or drag images above.</p>
			{/if}
		</div>
	{/if}
</div>
