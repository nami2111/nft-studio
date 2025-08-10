<script lang="ts">
	import type { Layer } from '$lib/types/layer';
	import TraitCard from '$lib/components/TraitCard.svelte';
	import VirtualTraitList from '$lib/components/VirtualTraitList.svelte';
	import {
		removeLayer,
		updateLayerName,
		addTrait,
		project,
		removeTrait,
		updateTraitRarity,
		updateTraitName
	} from '$lib/stores/project.store';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Trash2, Edit, Check, X, ChevronDown, ChevronRight } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import { getImageDimensions } from '$lib/utils';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { loadingStore } from '$lib/stores/loading.store';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		layer: Layer;
	}

	const { layer }: Props = $props();

	let layerName = $derived(layer.name);
	let isUploading = $derived(loadingStore.isLoading(`layer-upload-${layer.id}`));
	let uploadProgress = $state(0); // Track upload progress

	let isEditing = $state(false);
	let fileInputElement: HTMLInputElement | null = $state(null); // Reference to file input element
	let isDragover = $state(false);
	let isExpanded = $state(true);
	let searchTerm = $state(''); // For trait search/filter

	// Filter traits based on search term
	let filteredTraits = $derived(
		layer.traits.filter((trait) => trait.name.toLowerCase().includes(searchTerm.toLowerCase()))
	);

	// Bulk operation states
	let selectedTraits = new SvelteSet<string>();
	let bulkRarityWeight = $state(3);
	let bulkNewName = $state('');

	// Toggle trait selection
	function toggleTraitSelection(traitId: string) {
		if (selectedTraits.has(traitId)) {
			selectedTraits.delete(traitId);
		} else {
			selectedTraits.add(traitId);
		}
	}

	// Select all filtered traits
	function selectAllFiltered() {
		filteredTraits.forEach((trait) => selectedTraits.add(trait.id));
	}

	// Clear selection
	function clearSelection() {
		selectedTraits.clear();
	}

	// Bulk delete traits
	function bulkDelete() {
		if (selectedTraits.size === 0) return;

		// Show confirmation dialog
		toast.warning(`Are you sure you want to delete ${selectedTraits.size} trait(s)?`, {
			action: {
				label: 'Delete',
				onClick: () => {
					// Delete all selected traits
					selectedTraits.forEach((traitId) => {
						removeTrait(layer.id, traitId);
					});
					toast.success(`${selectedTraits.size} trait(s) deleted successfully.`);
					clearSelection();
				}
			},
			cancel: {
				label: 'Cancel',
				onClick: () => {}
			}
		});
	}

	// Bulk update rarity
	function bulkUpdateRarity() {
		if (selectedTraits.size === 0) return;

		// Update rarity for all selected traits
		selectedTraits.forEach((traitId) => {
			updateTraitRarity(layer.id, traitId, bulkRarityWeight);
		});
		toast.success(`Rarity updated for ${selectedTraits.size} trait(s).`);
	}

	// Bulk rename traits
	function bulkRename() {
		if (selectedTraits.size === 0 || !bulkNewName.trim()) return;

		if (bulkNewName.length > 100) {
			toast.error('Base name for bulk rename cannot exceed 100 characters.');
			return;
		}

		// Update name for all selected traits
		let count = 0;
		let successCount = 0;
		selectedTraits.forEach((traitId) => {
			const trait = layer.traits.find((t) => t.id === traitId);
			if (trait) {
				const newName = `${bulkNewName}_${count + 1}`;
				if (newName.length <= 100) {
					updateTraitName(layer.id, traitId, newName);
					successCount++;
				}
			}
			count++;
		});
		if (successCount > 0) {
			toast.success(`Renamed ${successCount} trait(s).`);
		}
		bulkNewName = '';
	}

	function handleNameChange() {
		if (layerName.trim() === '') {
			toast.error('Layer name cannot be empty.');
			layerName = layer.name; // Revert to original name
			return;
		}

		if (layerName.length > 100) {
			toast.error('Layer name cannot exceed 100 characters.');
			layerName = layer.name; // Revert to original name
			return;
		}

		updateLayerName(layer.id, layerName);
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

		// Start loading state
		loadingStore.start(`layer-upload-${layer.id}`);
		uploadProgress = 0;
		isDragover = false;

		try {
			// Filter for valid image files
			const imageFiles = Array.from(files).filter((file) => {
				// Check file type
				const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
				if (!validTypes.includes(file.type)) {
					return false;
				}

				// Check file extension
				const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
				const fileName = file.name.toLowerCase();
				return validExtensions.some((ext) => fileName.endsWith(ext));
			});

			if (imageFiles.length === 0) {
				import('svelte-sonner').then(({ toast }) => {
					toast.warning(
						'No valid image files were selected. Please upload PNG, JPG, GIF, or WebP files.'
					);
				});
				return;
			}

			// Limit batch size to prevent UI freezing
			const BATCH_SIZE = 10;
			let successCount = 0;
			let errorCount = 0;
			const totalFiles = imageFiles.length;

			for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
				const batch = imageFiles.slice(i, i + BATCH_SIZE);

				// Process batch in parallel
				const batchPromises = batch.map(async (file, index) => {
					let tempImageUrl: string | null = null;
					try {
						// Validate file size (max 10MB)
						if (file.size > 10 * 1024 * 1024) {
							throw new Error(`File "${file.name}" is too large (max 10MB)`);
						}

						// Get image dimensions
						const dimensions = await getImageDimensions(file);

						// Validate dimensions (must be positive)
						if (dimensions.width <= 0 || dimensions.height <= 0) {
							throw new Error(`File "${file.name}" has invalid dimensions`);
						}

						// For subsequent uploads, validate dimensions match project output size
						const projectData = get(project);
						if (projectData.outputSize.width > 0 && projectData.outputSize.height > 0) {
							// Allow some flexibility for rounding errors (±1 pixel)
							if (
								Math.abs(dimensions.width - projectData.outputSize.width) > 1 ||
								Math.abs(dimensions.height - projectData.outputSize.height) > 1
							) {
								throw new Error(
									`File "${file.name}" dimensions (${dimensions.width}x${dimensions.height}) do not match project output size (${projectData.outputSize.width}x${projectData.outputSize.height})`
								);
							}
						}

						tempImageUrl = URL.createObjectURL(file);
						// Normalize base name (remove extension, sanitize)
						const baseName = file.name.replace(/\.[^/.]+$/, '');
						const safeName = baseName
							.trim()
							.slice(0, 100)
							.replace(/[^a-zA-Z0-9._ -]/g, '_');

						// Ensure the name is not empty
						if (safeName.trim() === '') {
							throw new Error(`File "${file.name}" has an invalid name`);
						}

						await addTrait(layer.id, {
							name: safeName,
							imageUrl: tempImageUrl,
							imageData: file,
							width: dimensions.width,
							height: dimensions.height,
							rarityWeight: 3
						});
						return true;
					} catch (error) {
						// Clean up temporary object URL on error
						if (tempImageUrl) {
							try {
								URL.revokeObjectURL(tempImageUrl);
							} catch {
								// Ignore cleanup errors
							}
						}
						console.error(`Error processing file ${file.name}:`, error);
						// Show user-friendly error message
						import('svelte-sonner').then(({ toast }) => {
							toast.error(`Error processing file "${file.name}"`, {
								description: error instanceof Error ? error.message : 'Unknown error'
							});
						});
						return false;
					}
				});

				const batchResults = await Promise.all(batchPromises);
				successCount += batchResults.filter(Boolean).length;
				errorCount += batchResults.filter((r) => !r).length;

				// Update progress
				uploadProgress = Math.min(100, Math.round(((i + batch.length) / totalFiles) * 100));

				// Allow UI to update between batches
				if (i + BATCH_SIZE < imageFiles.length) {
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
			}

			if (errorCount === 0) {
				import('svelte-sonner').then(({ toast }) => {
					toast.success(`${successCount} trait(s) added successfully.`);
				});
			} else if (successCount > 0) {
				import('svelte-sonner').then(({ toast }) => {
					toast.warning(`${successCount} trait(s) added, ${errorCount} failed.`);
				});
			} else {
				import('svelte-sonner').then(({ toast }) => {
					toast.error('All files failed to upload. Please check the files and try again.');
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'An unknown error occurred.';
			import('svelte-sonner').then(({ toast }) => {
				toast.error(`Error uploading files: ${message}`);
			});
		} finally {
			// Stop loading state
			loadingStore.stop(`layer-upload-${layer.id}`);
			// Reset file input
			if (fileInputElement) {
				fileInputElement.value = '';
			}
		}
	}

	// Lazy loading for trait cards (secure; no innerHTML)
	let observer: IntersectionObserver | null = null;

	function createSafeLazyTraitCard(trait: (typeof layer.traits)[number]): HTMLElement {
		const root = document.createElement('div');
		root.className = 'lazy-trait-loaded';

		const wrapper = document.createElement('div');
		wrapper.className = 'overflow-hidden rounded-lg border border-gray-200';

		const imgContainer = document.createElement('div');
		imgContainer.className = 'flex aspect-square items-center justify-center bg-gray-100';

		if (trait.imageUrl) {
			const img = document.createElement('img');
			img.className = 'h-full w-full object-contain';
			// Only assign to src; do not inject HTML
			img.src = trait.imageUrl;
			img.alt = trait.name;
			imgContainer.appendChild(img);
		} else {
			const span = document.createElement('span');
			span.className = 'text-gray-500';
			span.textContent = 'No image';
			imgContainer.appendChild(span);
		}

		const body = document.createElement('div');
		body.className = 'p-2';

		const header = document.createElement('div');
		header.className = 'flex items-center justify-between';

		const title = document.createElement('p');
		title.className = 'truncate text-sm font-medium text-gray-900';
		title.title = trait.name;
		title.textContent = trait.name;

		header.appendChild(title);

		const controls = document.createElement('div');
		controls.className = 'flex';
		// Decorative placeholders; no onclick handlers here in lazy card (real actions are in TraitCard)
		const btnEdit = document.createElement('button');
		btnEdit.className = 'rounded p-1 hover:bg-gray-100';
		btnEdit.setAttribute('aria-label', 'Edit');
		const btnTrash = document.createElement('button');
		btnTrash.className = 'rounded p-1 hover:bg-gray-100';
		btnTrash.setAttribute('aria-label', 'Delete');
		controls.appendChild(btnEdit);
		controls.appendChild(btnTrash);
		header.appendChild(controls);

		const rarityBlock = document.createElement('div');
		rarityBlock.className = 'mt-2';

		const label = document.createElement('label');
		label.className = 'block text-xs font-medium text-gray-700';
		label.textContent = 'Rarity: ';
		const rarityValue = document.createElement('span');
		rarityValue.className = 'font-bold text-indigo-600';
		// Map weight to label (approximate)
		const labels: Record<number, string> = {
			1: 'Mythic',
			2: 'Legendary',
			3: 'Epic',
			4: 'Rare',
			5: 'Common'
		};
		rarityValue.textContent = labels[trait.rarityWeight] ?? String(trait.rarityWeight);
		label.appendChild(rarityValue);

		const rangeWrap = document.createElement('div');
		rangeWrap.className = 'mt-1 flex items-center';
		const range = document.createElement('input');
		range.type = 'range';
		range.min = '1';
		range.max = '5';
		range.step = '1';
		range.value = String(trait.rarityWeight);
		range.className =
			'thumb:bg-indigo-600 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200';
		range.title = `Rarity: ${labels[trait.rarityWeight] ?? trait.rarityWeight} (${trait.rarityWeight})`;
		range.disabled = true; // read-only in placeholder
		rangeWrap.appendChild(range);

		const hints = document.createElement('div');
		hints.className = 'mt-1 flex justify-between text-xs text-gray-500';
		const spanLeft = document.createElement('span');
		spanLeft.textContent = 'Rare';
		const spanRight = document.createElement('span');
		spanRight.textContent = 'Common';
		hints.appendChild(spanLeft);
		hints.appendChild(spanRight);

		rarityBlock.appendChild(label);
		rarityBlock.appendChild(rangeWrap);
		rarityBlock.appendChild(hints);

		body.appendChild(header);
		body.appendChild(rarityBlock);

		wrapper.appendChild(imgContainer);
		wrapper.appendChild(body);
		root.appendChild(wrapper);

		return root;
	}

	function initializeLazyLoading() {
		if (layer.traits.length <= 50) return;

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;

					const container = entry.target as HTMLElement;
					const traitId = container.dataset.traitId;
					const trait = layer.traits.find((t) => t.id === traitId);
					if (!trait) return;

					const placeholder = container.querySelector('.lazy-trait-placeholder');
					if (!placeholder) return;

					// Build safe DOM instead of innerHTML
					const traitCard = createSafeLazyTraitCard(trait);
					container.replaceChild(traitCard, placeholder);

					observer?.unobserve(container);
				});
			},
			{
				root: null,
				rootMargin: '50px',
				threshold: 0.1
			}
		);

		// Observe all lazy trait containers
		const lazyContainers = document.querySelectorAll('.lazy-trait-container');
		lazyContainers.forEach((container) => observer?.observe(container));
	}

	onMount(() => {
		initializeLazyLoading();
	});

	onDestroy(() => {
		if (observer) observer.disconnect();
		observer = null;
	});
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
				<div class="flex items-center">
					<h3 class="text-lg font-medium text-gray-900">{layer.name}</h3>
					{#if layer.isOptional}
						<span class="ml-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">Optional</span>
					{/if}
				</div>
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
						<div class="flex items-center justify-center">
							<div class="flex items-center justify-center">
								<LoadingIndicator
									operation={`layer-upload-${layer.id}`}
									message="Uploading files..."
								/>
							</div>
						</div>
						<div class="mt-2 h-2 w-full rounded-full bg-gray-200">
							<div
								class="h-full rounded-full bg-indigo-600 transition-all duration-300"
								style="width: {uploadProgress}%"
							></div>
						</div>
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
			<div class="mb-2 flex items-center justify-between">
				<h4 class="text-md font-medium text-gray-700">Traits ({layer.traits.length})</h4>
				{#if layer.traits.length > 5}
					<input
						type="text"
						placeholder="Search traits..."
						class="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
						bind:value={searchTerm}
					/>
				{/if}
			</div>

			<!-- Bulk operation controls -->
			{#if filteredTraits.length > 1}
				<div class="mb-2 flex items-center justify-between rounded bg-gray-100 p-2">
					<div class="flex items-center space-x-2">
						<Button variant="outline" size="sm" onclick={selectAllFiltered}>Select All</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={clearSelection}
							disabled={selectedTraits.size === 0}
						>
							Clear
						</Button>
						<span class="text-sm text-gray-600">
							{selectedTraits.size} selected
						</span>
					</div>
					{#if selectedTraits.size > 0}
						<div class="flex space-x-2">
							<Button
								variant="outline"
								size="sm"
								onclick={bulkDelete}
								class="text-red-600 hover:text-red-700"
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					{/if}
				</div>

				{#if selectedTraits.size > 0}
					<div class="mb-4 rounded border border-gray-200 p-3">
						<h5 class="mb-2 text-sm font-medium">Bulk Operations</h5>
						<div class="space-y-2">
							<div class="flex items-center space-x-2">
								<label for="bulk-rarity-{layer.id}" class="text-sm">Rarity:</label>
								<select
									id="bulk-rarity-{layer.id}"
									class="rounded border border-gray-300 px-2 py-1 text-sm"
									bind:value={bulkRarityWeight}
								>
									<option value="1">Mythic (1)</option>
									<option value="2">Legendary (2)</option>
									<option value="3">Epic (3)</option>
									<option value="4">Rare (4)</option>
									<option value="5">Common (5)</option>
								</select>
								<Button variant="outline" size="sm" onclick={bulkUpdateRarity}>Update</Button>
							</div>
							<div class="flex items-center space-x-2">
								<label for="bulk-rename-{layer.id}" class="text-sm">Rename:</label>
								<input
									id="bulk-rename-{layer.id}"
									type="text"
									placeholder="New name prefix"
									class="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
									bind:value={bulkNewName}
								/>
								<Button
									variant="outline"
									size="sm"
									onclick={bulkRename}
									disabled={!bulkNewName.trim()}
								>
									Rename
								</Button>
							</div>
						</div>
					</div>
				{/if}
			{/if}

			{#if layer.traits.length > 0}
				{#if layer.traits.length > 100}
					<!-- Use virtual scrolling for large trait lists -->
					<div class="h-96">
						<VirtualTraitList traits={filteredTraits} layerId={layer.id} {searchTerm} />
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
						{#each filteredTraits as trait (trait.id)}
							{#if layer.traits.length > 50}
								<!-- Lazy load trait cards when there are many traits -->
								<div class="lazy-trait-container" data-trait-id={trait.id}>
									<div class="lazy-trait-placeholder">
										<div class="h-full w-full rounded-lg bg-gray-200"></div>
									</div>
								</div>
							{:else}
								<TraitCard {trait} layerId={layer.id} />
							{/if}
						{/each}
					</div>
				{/if}
			{:else}
				<p class="text-sm text-gray-500">No traits added yet. Upload or drag images above.</p>
			{/if}
		</div>
	{/if}
</div>
