<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { Layer } from '$lib/types/layer';
	import { createTraitId, type TraitId } from '$lib/types/ids';
	import TraitCard from '$lib/components/TraitCard.svelte';
	import VirtualTraitList from '$lib/components/VirtualTraitList.svelte';
	import {
		project,
		startLoading,
		stopLoading,
		loadingStates,
		removeTrait,
		updateTraitRarity,
		updateTraitName,
		addTrait,
		updateLayerName,
		removeLayer,
		updateProjectDimensions
	} from '$lib/stores';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { Trash2, Edit, Check, X, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { getImageDimensions } from '$lib/utils';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	interface Props {
		layer: Layer;
	}

	const { layer }: Props = $props();

	let layerName = $derived(layer.name);
	let isUploading = $derived(loadingStates[`layer-upload-${layer.id}`] as boolean);

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
	let selectedTraits = new SvelteSet<TraitId>();
	let bulkNewName = $state('');

	// Toggle trait selection
	function toggleTraitSelection(traitId: TraitId) {
		if (selectedTraits.has(traitId)) {
			selectedTraits.delete(traitId);
		} else {
			selectedTraits.add(traitId);
		}
	}

	// Select all filtered traits
	function selectAllFiltered() {
		filteredTraits.forEach((trait) => selectedTraits.add(createTraitId(trait.id)));
	}

	// Clear selection
	function clearSelection() {
		selectedTraits.clear();
	}

	// Bulk delete traits
	function bulkDelete() {
		if (selectedTraits.size === 0) return;

		// Simple confirmation dialog
		if (confirm(`Are you sure you want to delete ${selectedTraits.size} trait(s)?`)) {
			try {
				// Delete all selected traits
				let deletedCount = 0;
				selectedTraits.forEach((traitId) => {
					removeTrait(layer.id, traitId);
					deletedCount++;
				});
				toast.success(`${deletedCount} trait(s) deleted successfully.`);
				clearSelection();
			} catch (error) {
				console.error('Failed to delete traits:', error);
				toast.error('Failed to delete some traits. Please try again.');
			}
		}
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
		startLoading(`layer-upload-${layer.id}`);
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

			// Validate file sizes first (quick synchronous check)
			const oversizedFiles = imageFiles.filter((file) => file.size > 10 * 1024 * 1024);
			if (oversizedFiles.length > 0) {
				import('svelte-sonner').then(({ toast }) => {
					toast.error(`${oversizedFiles.length} file(s) exceed 10MB limit and will be skipped.`);
				});
			}

			const validFiles = imageFiles.filter((file) => file.size <= 10 * 1024 * 1024);
			if (validFiles.length === 0) {
				import('svelte-sonner').then(({ toast }) => {
					toast.error('No valid files to upload (all files exceed 10MB limit).');
				});
				return;
			}

			// Get dimensions from first image only - all images should have same dimensions
			let firstImageDimensions: { width: number; height: number } | null = null;
			if (validFiles.length > 0) {
				try {
					firstImageDimensions = await getImageDimensions(validFiles[0]);
					uploadProgress = 50; // Dimension extraction is 50% of progress
				} catch (error) {
					console.error(`Failed to get dimensions for first image ${validFiles[0].name}:`, error);
					// Continue without dimensions - will fail validation later
				}
			}

			// Validate project dimensions match (fail fast)
			if (firstImageDimensions) {
				const { width, height } = firstImageDimensions;
				const projectData = project;
				if (projectData.outputSize.width > 0 && projectData.outputSize.height > 0) {
					// Allow some flexibility for rounding errors (±1 pixel)
					if (
						Math.abs(width - projectData.outputSize.width) > 1 ||
						Math.abs(height - projectData.outputSize.height) > 1
					) {
						import('svelte-sonner').then(({ toast }) => {
							toast.error(
								`First image dimensions (${width}x${height}) do not match project output size (${projectData.outputSize.width}x${projectData.outputSize.height}). All images must have the same dimensions.`
							);
						});
						return;
					}
				} else {
					// Set project dimensions from first image if not already set
					updateProjectDimensions({ width, height });
				}
			}

			// Process files in smaller batches for better UI responsiveness
			const BATCH_SIZE = 5; // Increased batch size for better performance
			let successCount = 0;
			let errorCount = 0;
			const totalFiles = validFiles.length;

			// Add all traits immediately without awaiting image processing
			for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
				const batch = validFiles.slice(i, i + BATCH_SIZE);

				// Add traits synchronously for immediate UI feedback
				batch.forEach((file) => {
					try {
						addTrait(layer.id, file);
					} catch (error) {
						console.error(`Error adding trait for ${file.name}:`, error);
						errorCount++;
					}
				});

				successCount += batch.length; // All files should succeed since validation passed

				// Update progress
				if (totalFiles > 0) {
					const batchProgress = Math.min(100, Math.round(((i + batch.length) / totalFiles) * 100));
					uploadProgress = 50 + Math.round(batchProgress / 2);
				} else {
					uploadProgress = 50;
				}

				// Allow UI to update between batches with reduced delay
				if (i + BATCH_SIZE < validFiles.length) {
					await new Promise((resolve) => setTimeout(resolve, 25));
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
			stopLoading(`layer-upload-${layer.id}`);
			// Reset file input
			if (fileInputElement) {
				fileInputElement.value = '';
			}
			// Force UI update by resetting progress after a short delay
			setTimeout(() => {
				uploadProgress = 0;
			}, 100);
		}
	}

	// Lazy loading for trait cards with improved memory management
	let observer: IntersectionObserver | null = null;

	function createSafeLazyTraitCard(trait: (typeof layer.traits)[number]): HTMLElement {
		const root = document.createElement('div');
		root.className = 'lazy-trait-loaded';

		const wrapper = document.createElement('div');
		wrapper.className = 'overflow-hidden rounded-lg border border-border';

		const imgContainer = document.createElement('div');
		imgContainer.className = 'flex aspect-square items-center justify-center bg-muted';

		// Check if trait has valid image data
		const hasValidImageData = trait.imageData && trait.imageData.byteLength > 0;
		const hasImageUrl = !!trait.imageUrl;

		if (hasImageUrl && hasValidImageData) {
			// Has both imageUrl and valid imageData
			const img = document.createElement('img');
			img.className = 'h-full w-full object-contain';
			img.loading = 'lazy';
			img.src = trait.imageUrl!;
			img.alt = trait.name;

			// Handle broken image URLs (e.g., from persisted projects)
			img.onerror = () => {
				if (hasValidImageData) {
					try {
						const blob = new Blob([trait.imageData], { type: 'image/png' });
						const newUrl = URL.createObjectURL(blob);
						img.src = newUrl;
						trait.imageUrl = newUrl;
					} catch (error) {
						console.error('Failed to recreate image URL:', error);
						img.style.display = 'none';
						showNeedsReupload(imgContainer);
					}
				} else {
					img.style.display = 'none';
					showNeedsReupload(imgContainer);
				}
			};

			imgContainer.appendChild(img);
		} else if (hasValidImageData && !trait.imageUrl) {
			// Has imageData but no imageUrl, create it
			const img = document.createElement('img');
			img.className = 'h-full w-full object-contain';
			img.loading = 'lazy';
			img.alt = trait.name;

			try {
				const blob = new Blob([trait.imageData], { type: 'image/png' });
				const url = URL.createObjectURL(blob);
				img.src = url;
				trait.imageUrl = url;
				imgContainer.appendChild(img);
			} catch (error) {
				console.error('Failed to create image URL:', error);
				showNeedsReupload(imgContainer);
			}
		} else if (trait.imageUrl && (!trait.imageData || trait.imageData.byteLength === 0)) {
			// Likely from persisted project - show needs re-upload indicator
			showNeedsReupload(imgContainer);
		} else {
			// Show loading spinner while image is being processed
			const loaderDiv = document.createElement('div');
			loaderDiv.className = 'flex h-full items-center justify-center';
			const spinner = document.createElement('div');
			spinner.className =
				'h-6 w-6 animate-spin rounded-full border-2 border-input border-t-indigo-600';
			loaderDiv.appendChild(spinner);
			imgContainer.appendChild(loaderDiv);
		}

		// Helper function to show "needs re-upload" indicator
		function showNeedsReupload(container: HTMLElement) {
			const needsReuploadDiv = document.createElement('div');
			needsReuploadDiv.className = 'flex h-full flex-col items-center justify-center p-2 text-center';
			needsReuploadDiv.innerHTML = `
				<div class="text-muted-foreground mb-2">
					<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
				<span class="text-muted-foreground text-xs">Image needs re-upload</span>
			`;
			container.appendChild(needsReuploadDiv);
		}

		const body = document.createElement('div');
		body.className = 'p-2';

		const header = document.createElement('div');
		header.className = 'flex items-center justify-between';

		const title = document.createElement('p');
		title.className = 'truncate text-sm font-medium text-foreground';
		title.title = trait.name;
		title.textContent = trait.name;

		header.appendChild(title);

		const controls = document.createElement('div');
		controls.className = 'flex';
		// Decorative placeholders; no onclick handlers here in lazy card (real actions are in TraitCard)
		const btnEdit = document.createElement('button');
		btnEdit.className = 'rounded p-1 hover:bg-muted';
		btnEdit.setAttribute('aria-label', 'Edit');
		const btnTrash = document.createElement('button');
		btnTrash.className = 'rounded p-1 hover:bg-muted';
		btnTrash.setAttribute('aria-label', 'Delete');
		controls.appendChild(btnEdit);
		controls.appendChild(btnTrash);
		header.appendChild(controls);

		const rarityBlock = document.createElement('div');
		rarityBlock.className = 'mt-2';

		const label = document.createElement('label');
		label.className = 'block text-xs font-medium text-foreground';
		label.textContent = 'Rarity: ';
		const rarityValue = document.createElement('span');
		rarityValue.className = 'font-bold text-primary';
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
			'thumb:bg-primary h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted';
		range.title = `Rarity: ${labels[trait.rarityWeight] ?? trait.rarityWeight} (${trait.rarityWeight})`;
		range.disabled = true; // read-only in placeholder
		rangeWrap.appendChild(range);

		const hints = document.createElement('div');
		hints.className = 'mt-1 flex justify-between text-xs text-muted-foreground';
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
		if (layer.traits.length <= 25) return; // Only for larger lists

		// Use more aggressive intersection observer settings
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

					// Unobserve after loading to save memory
					observer?.unobserve(container);
				});
			},
			{
				root: null,
				rootMargin: '100px', // Load earlier for better UX
				threshold: 0.01 // Trigger on any visibility
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

<Card class="w-full">
	<CardContent class="p-4">
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
						class="border-primary text-foreground border-b bg-transparent text-lg font-medium focus:outline-none"
						bind:value={layerName}
						onchange={handleNameChange}
						onkeydown={(e) => e.key === 'Enter' && handleNameChange()}
					/>
				{:else}
					<div class="flex items-center">
						<h3 class="text-foreground text-lg font-medium">{layer.name}</h3>
						{#if layer.isOptional}
							<span class="bg-muted text-foreground ml-2 rounded px-2 py-1 text-xs">Optional</span>
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
				<label class="text-foreground mb-1 block text-sm font-medium" for="file-upload-{layer.id}"
					>Upload Traits</label
				>
				<div
					class="flex justify-center rounded-md border-2 border-dashed px-6 pt-5 pb-6 transition-colors {isDragover
						? 'border-primary bg-muted'
						: 'border-border'}"
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
										isLoading={isUploading}
									/>
								</div>
							</div>
							<div class="bg-muted mt-2 h-2 w-full rounded-full">
								<div
									class="bg-primary h-full rounded-full transition-all duration-300"
									style="width: {uploadProgress}%"
								></div>
							</div>
						{:else}
							<svg
								class="text-muted-foreground mx-auto h-12 w-12"
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
							<div class="text-muted-foreground flex text-sm">
								<label
									for="file-upload-{layer.id}"
									class="bg-background text-primary focus-within:ring-ring hover:text-primary/80 relative cursor-pointer rounded-md font-medium focus-within:ring-2 focus-within:ring-offset-2"
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
							<p class="text-muted-foreground text-xs">PNG, JPG, GIF, etc.</p>
						{/if}
					</div>
				</div>
			</div>
			<div class="mt-4">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-md text-foreground font-medium">Traits ({layer.traits.length})</h4>
					{#if layer.traits.length > 5}
						<input
							type="text"
							placeholder="Search traits..."
							class="border-input w-32 rounded border px-2 py-1 text-sm"
							bind:value={searchTerm}
						/>
					{/if}
				</div>

				<!-- Bulk operation controls -->
				{#if filteredTraits.length > 1}
					<div class="bg-muted mb-3 rounded p-2 sm:mb-2">
						<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex flex-wrap items-center gap-1 sm:gap-2">
								<Button variant="outline" size="sm" onclick={selectAllFiltered} class="text-xs"
									>Select All</Button
								>
								<Button
									variant="outline"
									size="sm"
									onclick={clearSelection}
									disabled={selectedTraits.size === 0}
									class="text-xs"
								>
									Clear
								</Button>
								<span class="text-muted-foreground text-xs sm:text-sm">
									{selectedTraits.size} selected
								</span>
							</div>
							{#if selectedTraits.size > 0}
								<div class="flex justify-end sm:justify-start">
									<Button
										variant="outline"
										size="sm"
										onclick={bulkDelete}
										class="text-xs text-red-600 hover:text-red-700"
									>
										<Trash2 class="h-3 w-3 sm:h-4 sm:w-4" />
									</Button>
								</div>
							{/if}
						</div>
					</div>

					{#if selectedTraits.size > 0}
						<div class="border-border mb-4 rounded border p-3">
							<h5 class="mb-2 text-sm font-medium">Bulk Rename</h5>
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
								<label for="bulk-rename-{layer.id}" class="text-sm">Rename:</label>
								<input
									id="bulk-rename-{layer.id}"
									type="text"
									placeholder="New name prefix"
									class="border-input w-full rounded border px-2 py-1 text-sm sm:w-32"
									bind:value={bulkNewName}
								/>
								<Button
									variant="outline"
									size="sm"
									onclick={bulkRename}
									disabled={!bulkNewName.trim()}
									class="w-full sm:w-auto"
								>
									Rename
								</Button>
							</div>
						</div>
					{/if}
				{/if}

				{#if layer.traits.length > 0}
					{#if layer.traits.length > 100}
						<!-- Use virtual scrolling for large trait lists -->
						<div class="h-96">
							<VirtualTraitList
								traits={filteredTraits}
								layerId={layer.id}
								{searchTerm}
								{selectedTraits}
								onToggleSelection={(traitId: string) =>
									toggleTraitSelection(createTraitId(traitId))}
								showSelection={filteredTraits.length > 1}
							/>
						</div>
					{:else}
						<div
							class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
						>
							{#each filteredTraits as trait (trait.id)}
								<TraitCard
									{trait}
									layerId={layer.id}
									selected={selectedTraits.has(createTraitId(trait.id))}
									onToggleSelection={() => toggleTraitSelection(createTraitId(trait.id))}
									showSelection={filteredTraits.length > 1}
								/>
							{/each}
						</div>
					{/if}
				{:else}
					<p class="text-muted-foreground text-sm">
						No traits added yet. Upload or drag images above.
					</p>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
