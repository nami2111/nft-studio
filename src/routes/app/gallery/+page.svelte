<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import GalleryImport from '$lib/components/gallery/GalleryImport.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { GalleryNFT, GalleryCollection } from '$lib/types/gallery';
	import { trackGalleryPageVisit } from '$lib/utils/analytics';
	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import SimpleVirtualGrid from '$lib/components/gallery/SimpleVirtualGrid.svelte';
	import { debugLog, debugTime, debugCount } from '$lib/utils/simple-debug';
	import { formatDate } from '$lib/utils/formatters';
	import { detectImageFormat, getMimeType } from '$lib/utils/image-format-detector';

	let isLoading = $derived(galleryStore.isLoading);
	let collections = $derived(galleryStore.collections);
	let totalNFTs = $derived(collections.reduce((sum, col) => sum + col.totalSupply, 0));
	let selectedNFT = $derived(galleryStore.selectedNFT);

	// The active collection from the store, with a safe fallback in the template
	let selectedCollection = $derived(galleryStore.selectedCollection);
	let totalNFTsInCollection = $derived(selectedCollection?.totalSupply || 0);

	// Use store state for filters
	let searchQuery = $state(galleryStore.filterOptions.search || '');
	let selectedSort = $state<any>(galleryStore.sortOption || 'rarity-asc');
	let selectedTraits = $state<Record<string, string[]>>(
		galleryStore.filterOptions.selectedTraits || {}
	);

	// Sync local filter state to store (using untrack to prevent loops)
	$effect(() => {
		const search = searchQuery;
		const traits = $state.snapshot(selectedTraits);
		untrack(() => {
			galleryStore.setFilterOptions({
				search,
				selectedTraits: traits
			});
		});
	});

	$effect(() => {
		const sort = selectedSort;
		untrack(() => {
			galleryStore.setSortOption(sort);
		});
	});

	let sortDropdownOpen = $state(false);
	let sortButtonRef = $state<HTMLButtonElement | null>(null);
	let dropdownPosition = $state({ top: 0, left: 0, width: 0 });

	// Use store's optimized filtering and sorting
	let filteredNFTs = $derived(galleryStore.filteredAndSortedNFTs);

	// No longer syncing selectedCollection back to store via $effect to avoid loops.
	// We handle initial selection in an effect that only runs when collections load.
	$effect(() => {
		if (collections.length > 0 && !galleryStore.selectedCollection) {
			untrack(() => {
				galleryStore.setSelectedCollection(collections[0]);
			});
		}
	});

	// Get all unique traits for filters from the store
	let allTraits = $derived(galleryStore.allTraits);

	// Track Object URLs for cleanup
	const objectUrls = new Set<string>();

	// Clean up Object URLs when component is destroyed
	onDestroy(() => {
		objectUrls.forEach((url) => URL.revokeObjectURL(url));
		objectUrls.clear();
	});

	function createObjectUrl(imageData: ArrayBuffer): string {
		// Detect the image format from the binary data
		const imageFormat = detectImageFormat(imageData);
		const mimeType = getMimeType(imageFormat);

		const url = URL.createObjectURL(new Blob([imageData], { type: mimeType }));
		objectUrls.add(url);
		return url;
	}

	function forceClearCache() {
		console.log('Force clearing gallery cache...');
		galleryStore.clearGallery();
		imageUrlCache.clear();
		window.location.reload();
	}

	function selectNFT(nft: GalleryNFT) {
		galleryStore.setSelectedNFT(nft);
	}

	function selectCollection(collection: any) {
		galleryStore.setSelectedCollection(collection);
	}

	// Toggle trait filter when clicking on traits in NFT details
	function toggleTraitFilter(layer: string, trait: string) {
		if (!selectedTraits[layer]) {
			selectedTraits[layer] = [];
		}

		const index = selectedTraits[layer].indexOf(trait);
		if (index > -1) {
			// Remove trait if already selected
			selectedTraits[layer].splice(index, 1);
			if (selectedTraits[layer].length === 0) {
				delete selectedTraits[layer];
			}
		} else {
			// Add trait if not selected
			selectedTraits[layer].push(trait);
		}
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedSort = 'rarity-asc';
		selectedTraits = {};
	}

	// Page visit tracking
	onMount(() => {
		// DANGER: Removed galleryStore.clearGallery() which was deleting all user data!
		trackGalleryPageVisit();
	});

	// Toggle dropdown and calculate position
	function toggleSortDropdown() {
		if (!sortDropdownOpen && sortButtonRef) {
			const rect = sortButtonRef.getBoundingClientRect();
			const scrollY = window.scrollY;
			dropdownPosition = {
				top: rect.bottom + scrollY + 4, // Add scroll position and gap
				left: rect.left,
				width: rect.width
			};
		}
		sortDropdownOpen = !sortDropdownOpen;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		if (!target.closest('.sort-dropdown-container')) {
			sortDropdownOpen = false;
		}
	}

	// Add/remove event listener for click outside
	$effect(() => {
		if (sortDropdownOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<div class="bg-background min-h-screen">
	{#if isLoading}
		<!-- Loading State -->
		<div class="flex min-h-[60vh] items-center justify-center">
			<div class="text-center">
				<div class="text-muted-foreground mb-2 text-lg">Loading gallery...</div>
				<div class="bg-muted mx-auto h-2 w-48 max-w-sm animate-pulse rounded-full"></div>
			</div>
		</div>
	{:else}
		<!-- Gallery Header -->
		<div
			class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur"
		>
			<div class="mx-auto max-w-screen-2xl px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 class="text-foreground text-2xl font-bold sm:text-3xl">NFT Gallery</h1>
						<p class="text-muted-foreground mt-1 text-sm">
							View and manage your generated NFT collections
						</p>
					</div>

					<!-- Gallery Stats -->
					<div class="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
						<div>
							<span class="text-foreground font-medium">{totalNFTs}</span> Total NFTs
						</div>
						<div>
							<span class="text-foreground font-medium">{collections.length}</span> Collections
						</div>
						<button
							type="button"
							class="text-xs text-red-600 underline hover:text-red-700"
							onclick={forceClearCache}
						>
							Clear Cache
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		{#if collections.length === 0}
			<!-- Empty State with Import -->
			<div class="flex min-h-[calc(100vh-200px)] items-center justify-center p-6">
				<div class="w-full max-w-4xl text-center">
					<svg
						class="text-muted-foreground mx-auto h-16 w-16"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1" />
						<circle cx="8.5" cy="8.5" r="1.5" stroke-width="1" />
						<polyline points="21 15 16 10 5 21" stroke-width="1" />
					</svg>
					<h2 class="mb-2 text-xl font-semibold">No collections yet</h2>
					<p class="text-muted-foreground mb-6">
						Generate NFTs in Generate Mode or import existing collections to get started.
					</p>
					<GalleryImport />
				</div>
			</div>
		{:else}
			<!-- Mobile Layout (below 640px) -->
			<div class="sm:hidden">
				{#if selectedCollection}
					<!-- Collection Header - Mobile -->
					<div class="bg-background/95 border-b p-4 backdrop-blur">
						<h2 class="text-lg font-bold">{selectedCollection.name}</h2>
						<p class="text-muted-foreground text-sm">{selectedCollection.description}</p>
						<div class="text-muted-foreground mt-1 text-xs">
							{selectedCollection.totalSupply} NFTs • {new Date(
								selectedCollection.generatedAt
							).toLocaleDateString()}
						</div>
					</div>

					<!-- Search and Filters - Mobile -->
					<div class="bg-background/95 border-b p-3 backdrop-blur">
						<div class="space-y-3">
							<!-- Search Bar - Mobile -->
							<div class="flex flex-col gap-2">
								<input
									type="text"
									placeholder="Search NFTs..."
									bind:value={searchQuery}
									class="focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
								/>
								<div class="relative flex gap-2">
									<!-- Custom Sort Dropdown -->
									<div class="sort-dropdown-container relative flex-1">
										<button
											bind:this={sortButtonRef}
											type="button"
											onclick={toggleSortDropdown}
											class="focus:ring-primary flex w-full justify-between rounded-md border px-2 py-2 text-sm focus:ring-2 focus:outline-none"
										>
											<span>
												{#if selectedSort === 'name-asc'}Name (A-Z)
												{:else if selectedSort === 'name-desc'}Name (Z-A)
												{:else if selectedSort === 'rarity-asc'}Rarity (Low to High)
												{:else if selectedSort === 'rarity-desc'}Rarity (High to Low)
												{/if}
											</span>
											<span class="text-muted-foreground">▼</span>
										</button>
									</div>

									<button
										type="button"
										onclick={clearFilters}
										class="hover:bg-muted rounded-md border px-3 py-2 text-xs whitespace-nowrap transition-colors"
									>
										Clear
									</button>
								</div>
							</div>

							<!-- Trait Filters - Mobile -->
							{#if Object.keys(allTraits).length > 0}
								<div class="space-y-2">
									<div class="text-xs font-medium">Filters</div>
									<div class="max-h-32 space-y-2 overflow-y-auto">
										{#each Object.entries(allTraits) as [layer, values]}
											<div>
												<div class="text-muted-foreground mb-1 text-xs font-medium">{layer}</div>
												<div class="flex flex-wrap gap-1">
													{#each values.slice(0, 6) as value}
														<button
															type="button"
															onclick={() => toggleTraitFilter(layer, value)}
															class="rounded border px-2 py-1 text-xs transition-all {selectedTraits[
																layer
															]?.includes(value)
																? 'bg-primary text-primary-foreground border-primary shadow-sm'
																: 'hover:bg-muted border-border text-foreground'}"
															title={selectedTraits[layer]?.includes(value)
																? 'Remove filter'
																: 'Filter by this trait'}
														>
															{value}
															{#if selectedTraits[layer]?.includes(value)}
																<span class="ml-1 font-bold">✓</span>
															{:else}
																<span class="text-muted-foreground ml-1">+</span>
															{/if}
														</button>
													{/each}
													{#if values.length > 6}
														<button
															type="button"
															class="text-muted-foreground hover:bg-muted rounded border px-2 py-1 text-xs"
														>
															+{values.length - 6}
														</button>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Results Count - Mobile -->
							<div class="text-muted-foreground text-xs">
								{filteredNFTs.length} of {selectedCollection.totalSupply} NFTs
							</div>
						</div>
					</div>

					<!-- NFT Grid - Mobile with Virtual Scrolling -->
					<div class="overflow-y-auto p-2" style="max-height: calc(100vh - 300px);">
						<SimpleVirtualGrid
							nfts={filteredNFTs}
							{selectedNFT}
							onselect={selectNFT}
							columns={3}
							itemHeight={150}
							gap={8}
							class="px-1"
						/>
					</div>

					<!-- Mobile NFT Details Panel -->
					{#if selectedNFT}
						<div
							class="fixed right-0 bottom-0 left-0 max-h-[40vh] overflow-y-auto border-t bg-white/95 p-3 backdrop-blur"
						>
							<div class="mb-2 flex items-center justify-between">
								<h3 class="text-sm font-semibold">NFT Details</h3>
								<button
									type="button"
									onclick={() => (selectedNFT = null)}
									class="text-muted-foreground hover:text-foreground text-sm"
								>
									✕
								</button>
							</div>

							<div class="flex gap-3">
								<!-- NFT Image - Mobile -->
								<div class="bg-muted h-24 w-24 flex-shrink-0 overflow-hidden rounded">
									{#if selectedNFT.imageData && (typeof selectedNFT.imageData === 'string' || selectedNFT.imageData.byteLength > 0)}
										<img
											src={imageUrlCache.get(selectedNFT.id, selectedNFT.imageData)}
											alt={selectedNFT.name}
											class="h-full w-full object-contain"
										/>
									{:else}
										<div
											class="text-muted-foreground flex h-full w-full items-center justify-center text-xs"
										>
											No Img
										</div>
									{/if}
								</div>

								<!-- NFT Info - Mobile -->
								<div class="min-w-0 flex-1">
									<h4 class="truncate text-sm font-bold">{selectedNFT.name}</h4>
									<div class="text-muted-foreground text-xs">
										Rank #{selectedNFT.rarityRank} • Score: {selectedNFT.rarityScore.toFixed(1)}
									</div>
									{#if selectedNFT.description}
										<p class="text-muted-foreground mt-1 line-clamp-2 text-xs">
											{selectedNFT.description}
										</p>
									{/if}

									<!-- Traits - Mobile -->
									{#if selectedNFT.metadata.traits && selectedNFT.metadata.traits.length > 0}
										<div class="mt-2">
											<div class="scrollbar-hide flex gap-1 overflow-x-auto pb-1">
												{#each selectedNFT.metadata.traits as trait}
													{@const layer = trait.layer || (trait as any).trait_type}
													{@const traitValue = trait.trait || (trait as any).value}
													{@const isSelected = selectedTraits[layer]?.includes(traitValue)}
													<button
														type="button"
														class="flex-shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-xs transition-all {isSelected
															? 'bg-primary text-primary-foreground shadow-sm'
															: 'bg-muted/70 hover:bg-muted text-foreground'}"
														onclick={() => toggleTraitFilter(layer, traitValue)}
														title={isSelected ? 'Remove filter' : 'Filter by this trait'}
													>
														{traitValue}
														{#if isSelected}
															<span class="ml-1 font-bold">✓</span>
														{:else}
															<span class="text-muted-foreground ml-1">+</span>
														{/if}
													</button>
												{/each}
											</div>
											{#if Object.keys(selectedTraits).length > 0}
												<div class="text-muted-foreground mt-1 text-xs">
													{Object.values(selectedTraits).flat().length} filter{Object.values(
														selectedTraits
													).flat().length !== 1
														? 's'
														: ''} active
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Mobile Landscape / Small Tablet (640px to 899px) -->
			<div class="hidden sm:block md:hidden">
				{#if selectedCollection}
					<!-- Collection Header - Mobile Landscape -->
					<div class="bg-background/95 border-b p-4 backdrop-blur">
						<h2 class="text-xl font-bold">{selectedCollection.name}</h2>
						<p class="text-muted-foreground mt-1">{selectedCollection.description}</p>
						<div class="text-muted-foreground mt-1 text-sm">
							{selectedCollection.totalSupply} NFTs • {new Date(
								selectedCollection.generatedAt
							).toLocaleDateString()}
						</div>
					</div>

					<!-- Search and Filters - Mobile Landscape -->
					<div class="bg-background/95 border-b p-3 backdrop-blur">
						<div class="flex gap-2">
							<input
								type="text"
								placeholder="Search NFTs..."
								bind:value={searchQuery}
								class="focus:ring-primary flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
							/>
							<select
								bind:value={selectedSort}
								class="focus:ring-primary rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
							>
								<option value="name-asc">Name (A-Z)</option>
								<option value="name-desc">Name (Z-A)</option>
								<option value="rarity-asc">Rarity (Low to High)</option>
								<option value="rarity-desc">Rarity (High to Low)</option>
							</select>
							<button
								type="button"
								onclick={clearFilters}
								class="hover:bg-muted rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-colors"
							>
								Clear
							</button>
						</div>

						<!-- Results Count - Mobile Landscape -->
						<div class="text-muted-foreground mt-2 text-sm">
							{filteredNFTs.length} of {selectedCollection.totalSupply} NFTs
						</div>
					</div>

					<!-- Main Layout Container - Mobile Landscape -->
					<div class="relative">
						<!-- Left: NFT Grid -->
						<div class="min-h-[calc(100vh-220px)] w-[100%] pr-[320px]">
							<!-- NFT Grid - Mobile Landscape with 5 columns -->
							<div class="overflow-y-auto p-3" style="max-height: calc(100vh - 220px);">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={5}
									itemHeight={140}
									gap={8}
								/>
							</div>
						</div>

						<!-- Right: Fixed Details Panel -->
						<div
							class="border-border bg-background/95 fixed top-[calc(120px+180px)] right-0 h-[calc(100vh-220px)] w-[300px] border-l backdrop-blur"
						>
							{#if selectedNFT}
								<!-- NFT Details - Mobile Landscape -->
								<div class="h-full overflow-y-auto p-4">
									<h3 class="mb-4 font-semibold">NFT Details</h3>

									<!-- NFT Image -->
									<div
										class="bg-muted mx-auto mb-4 aspect-square max-w-[250px] overflow-hidden rounded-lg"
									>
										{#if selectedNFT.imageData && (typeof selectedNFT.imageData === 'string' || selectedNFT.imageData.byteLength > 0)}
											<img
												src={imageUrlCache.get(selectedNFT.id, selectedNFT.imageData)}
												alt={selectedNFT.name}
												class="h-full w-full object-contain"
											/>
										{:else}
											<div
												class="text-muted-foreground flex h-full w-full items-center justify-center text-sm"
											>
												No Image
											</div>
										{/if}
									</div>

									<!-- NFT Name -->
									<div class="mb-3">
										<h4 class="mb-1 text-lg font-bold">{selectedNFT.name}</h4>
										<div class="text-muted-foreground text-sm">
											Rank #{selectedNFT.rarityRank} • Score: {selectedNFT.rarityScore.toFixed(1)}
										</div>
									</div>

									<!-- NFT Description -->
									{#if selectedNFT.description}
										<div class="mb-3">
											<div class="mb-1 font-medium">Description</div>
											<p class="text-muted-foreground text-sm">{selectedNFT.description}</p>
										</div>
									{/if}

									<!-- Traits -->
									{#if selectedNFT.metadata.traits && selectedNFT.metadata.traits.length > 0}
										<div class="mb-4">
											<div class="mb-2 font-medium">Traits (click to filter)</div>
											<div class="space-y-1">
												{#each selectedNFT.metadata.traits as trait}
													{@const layer = trait.layer || (trait as any).trait_type}
													{@const traitValue = trait.trait || (trait as any).value}
													{@const isSelected = selectedTraits[layer]?.includes(traitValue)}
													<button
														type="button"
														class="flex w-full cursor-pointer items-center justify-between rounded p-2 text-left text-sm transition-all {isSelected
															? 'bg-primary text-primary-foreground ring-primary/50 shadow-md ring-2'
															: 'bg-muted/30 hover:bg-muted/50 text-foreground'}"
														onclick={() => toggleTraitFilter(layer, traitValue)}
														onkeydown={(e) => {
															if (e.key === 'Enter' || e.key === ' ') {
																e.preventDefault();
																toggleTraitFilter(layer, traitValue);
															}
														}}
														title={isSelected
															? 'Click to remove filter'
															: 'Click to filter by this trait'}
													>
														<div class="flex items-center gap-2">
															<div
																class="h-2 w-2 rounded-full {isSelected
																	? 'bg-primary-foreground'
																	: 'bg-muted-foreground'}"
															></div>
															<span class="font-medium">{layer}:</span>
															<span class={isSelected ? 'text-primary-foreground' : ''}
																>{traitValue}</span
															>
														</div>
														{#if trait.rarity}
															<span
																class="{isSelected
																	? 'text-primary-foreground bg-primary-foreground/20'
																	: 'text-muted-foreground bg-background'} rounded px-2 py-1 text-xs"
																>{trait.rarity}%</span
															>
														{/if}
													</button>
												{/each}
											</div>
											{#if Object.keys(selectedTraits).length > 0}
												<div class="text-muted-foreground mt-2 text-xs">
													{Object.values(selectedTraits).flat().length} trait{Object.values(
														selectedTraits
													).flat().length !== 1
														? 's'
														: ''} selected
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{:else if selectedCollection}
								<div class="flex h-full items-center justify-center p-4 text-center">
									<div class="text-muted-foreground">
										<svg
											class="text-muted-foreground mx-auto h-12 w-12"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-3z"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<circle cx="12" cy="13" r="3" stroke-width="1" />
											<path
												d="M12 13v.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<path
												d="M16 11h.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<path
												d="M8 11h.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
										<div class="text-sm">Click an NFT to view details</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Tablet Layout (md: 768px to lg: 1023px) - iPad Portrait -->
			<div class="hidden md:block lg:hidden">
				{#if selectedCollection}
					<!-- Collection Header - Tablet -->
					<div class="bg-background/95 border-b p-5 backdrop-blur">
						<h2 class="text-xl font-bold">{selectedCollection.name}</h2>
						<p class="text-muted-foreground mt-1">{selectedCollection.description}</p>
						<div class="text-muted-foreground mt-2 text-sm">
							{selectedCollection.totalSupply} NFTs • {new Date(
								selectedCollection.generatedAt
							).toLocaleDateString()}
						</div>
					</div>

					<!-- Search and Filters - Tablet -->
					<div class="bg-background/95 border-b p-4 backdrop-blur">
						<div class="space-y-3">
							<!-- Search Bar - Tablet -->
							<div class="flex flex-col gap-3">
								<input
									type="text"
									placeholder="Search NFTs..."
									bind:value={searchQuery}
									class="focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
								/>
								<div class="flex gap-2">
									<!-- Custom Sort Dropdown - Tablet -->
									<div class="sort-dropdown-container relative flex-1">
										<button
											bind:this={sortButtonRef}
											type="button"
											onclick={toggleSortDropdown}
											class="focus:ring-primary flex w-full justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
										>
											<span>
												{#if selectedSort === 'name-asc'}Name (A-Z)
												{:else if selectedSort === 'name-desc'}Name (Z-A)
												{:else if selectedSort === 'rarity-asc'}Rarity (Low to High)
												{:else if selectedSort === 'rarity-desc'}Rarity (High to Low)
												{/if}
											</span>
											<span class="text-muted-foreground">▼</span>
										</button>
									</div>

									<button
										type="button"
										onclick={clearFilters}
										class="hover:bg-muted rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-colors"
									>
										Clear
									</button>
								</div>
							</div>

							<!-- Trait Filters - Tablet -->
							{#if Object.keys(allTraits).length > 0}
								<div class="space-y-2">
									<div class="text-sm font-medium">Filters</div>
									<div class="max-h-40 space-y-2 overflow-y-auto">
										{#each Object.entries(allTraits) as [layer, values]}
											<div>
												<div class="text-muted-foreground mb-1 text-xs font-medium">{layer}</div>
												<div class="flex flex-wrap gap-1">
													{#each values.slice(0, 8) as value}
														<button
															type="button"
															onclick={() => toggleTraitFilter(layer, value)}
															class="rounded border px-2 py-1 text-xs transition-all {selectedTraits[
																layer
															]?.includes(value)
																? 'bg-primary text-primary-foreground border-primary shadow-sm'
																: 'hover:bg-muted border-border text-foreground'}"
															title={selectedTraits[layer]?.includes(value)
																? 'Remove filter'
																: 'Filter by this trait'}
														>
															{value}
															{#if selectedTraits[layer]?.includes(value)}
																<span class="ml-1 font-bold">✓</span>
															{:else}
																<span class="text-muted-foreground ml-1">+</span>
															{/if}
														</button>
													{/each}
													{#if values.length > 8}
														<button
															type="button"
															class="text-muted-foreground hover:bg-muted rounded border px-2 py-1 text-xs"
														>
															+{values.length - 8}
														</button>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Results Count - Tablet -->
							<div class="text-muted-foreground text-sm">
								{filteredNFTs.length} of {selectedCollection.totalSupply} NFTs
							</div>
						</div>
					</div>

					<!-- Main Layout Container - Tablet Portrait -->
					<div class="relative">
						<!-- Left: NFT Grid (100% with padding for sidebar) -->
						<div class="min-h-[calc(100vh-280px)] w-[100%] pr-[320px]">
							<!-- NFT Grid - Tablet Portrait with 4 columns -->
							<div class="overflow-y-auto p-4" style="max-height: calc(100vh - 280px);">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={4}
									itemHeight={180}
									gap={12}
								/>
							</div>
						</div>

						<!-- Right: Fixed Details Panel (320px width) - Tablet Portrait -->
						<div
							class="border-border bg-background/95 fixed top-[calc(120px+240px)] right-0 h-[calc(100vh-280px)] w-[320px] border-l backdrop-blur"
						>
							{#if selectedNFT}
								<!-- NFT Details - Tablet -->
								<div class="h-full overflow-y-auto p-4">
									<h3 class="mb-4 font-semibold">NFT Details</h3>

									<!-- NFT Image - Tablet -->
									<div
										class="bg-muted mx-auto mb-4 aspect-square max-w-[300px] overflow-hidden rounded-lg"
									>
										{#if selectedNFT.imageData && (typeof selectedNFT.imageData === 'string' || selectedNFT.imageData.byteLength > 0)}
											<img
												src={imageUrlCache.get(selectedNFT.id, selectedNFT.imageData)}
												alt={selectedNFT.name}
												class="h-full w-full object-contain"
											/>
										{:else}
											<div
												class="text-muted-foreground flex h-full w-full items-center justify-center text-sm"
											>
												No Image
											</div>
										{/if}
									</div>

									<!-- NFT Name - Tablet -->
									<div class="mb-3">
										<h4 class="mb-1 text-lg font-bold">{selectedNFT.name}</h4>
										<div class="text-muted-foreground text-sm">
											Rank #{selectedNFT.rarityRank} • Score: {selectedNFT.rarityScore.toFixed(1)}
										</div>
									</div>

									<!-- NFT Description - Tablet -->
									{#if selectedNFT.description}
										<div class="mb-3">
											<div class="mb-1 font-medium">Description</div>
											<p class="text-muted-foreground text-sm">{selectedNFT.description}</p>
										</div>
									{/if}

									<!-- Traits - Tablet -->
									{#if selectedNFT.metadata.traits && selectedNFT.metadata.traits.length > 0}
										<div class="mb-4">
											<div class="mb-2 font-medium">Traits (click to filter)</div>
											<div class="space-y-1">
												{#each selectedNFT.metadata.traits as trait}
													{@const layer = trait.layer || (trait as any).trait_type}
													{@const traitValue = trait.trait || (trait as any).value}
													{@const isSelected = selectedTraits[layer]?.includes(traitValue)}
													<button
														type="button"
														class="flex w-full cursor-pointer items-center justify-between rounded p-2 text-left text-sm transition-all {isSelected
															? 'bg-primary text-primary-foreground ring-primary/50 shadow-md ring-2'
															: 'bg-muted/30 hover:bg-muted/50 text-foreground'}"
														onclick={() => toggleTraitFilter(layer, traitValue)}
														onkeydown={(e) => {
															if (e.key === 'Enter' || e.key === ' ') {
																e.preventDefault();
																toggleTraitFilter(layer, traitValue);
															}
														}}
														title={isSelected
															? 'Click to remove filter'
															: 'Click to filter by this trait'}
													>
														<div class="flex items-center gap-2">
															<div
																class="h-2 w-2 rounded-full {isSelected
																	? 'bg-primary-foreground'
																	: 'bg-muted-foreground'}"
															></div>
															<span class="font-medium">{layer}:</span>
															<span class={isSelected ? 'text-primary-foreground' : ''}
																>{traitValue}</span
															>
														</div>
														{#if trait.rarity}
															<span
																class="{isSelected
																	? 'text-primary-foreground bg-primary-foreground/20'
																	: 'text-muted-foreground bg-background'} rounded px-2 py-1 text-xs"
																>{trait.rarity}%</span
															>
														{/if}
													</button>
												{/each}
											</div>
											{#if Object.keys(selectedTraits).length > 0}
												<div class="text-muted-foreground mt-2 text-xs">
													{Object.values(selectedTraits).flat().length} trait{Object.values(
														selectedTraits
													).flat().length !== 1
														? 's'
														: ''} selected
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{:else if selectedCollection}
								<div class="flex h-full items-center justify-center p-4 text-center">
									<div class="text-muted-foreground">
										<svg
											class="text-muted-foreground mx-auto h-12 w-12"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-3z"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<circle cx="12" cy="13" r="3" stroke-width="1" />
											<path
												d="M12 13v.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<path
												d="M16 11h.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<path
												d="M8 11h.01"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
										<div class="text-sm">Click an NFT to view details</div>
									</div>
								</div>
							{/if}
						</div>
						<!-- Add padding to account for fixed right panel -->
						<div class="w-[40%]"></div>
					</div>
				{/if}
			</div>

			<!-- Desktop Layout (1024px and above) -->
			<div class="hidden lg:block">
				<!-- Main Layout Container -->
				<div class="relative">
					<!-- Left: NFT Grid (70% width) -->
					<div class="min-h-[calc(100vh-120px)] w-[70%]">
						{#if selectedCollection}
							<!-- Collection Header -->
							<div class="bg-background/95 border-b p-6 backdrop-blur">
								<h2 class="text-2xl font-bold">{selectedCollection.name}</h2>
								<p class="text-muted-foreground">{selectedCollection.description}</p>
								<div class="text-muted-foreground mt-1 text-sm">
									{selectedCollection.totalSupply} NFTs • {new Date(
										selectedCollection.generatedAt
									).toLocaleDateString()}
								</div>
							</div>

							<!-- Search and Filters -->
							<div class="bg-background/95 border-b p-4 backdrop-blur">
								<div class="space-y-4">
									<!-- Search Bar -->
									<div class="flex items-center gap-4">
										<div class="flex-1">
											<input
												type="text"
												placeholder="Search NFTs by name..."
												bind:value={searchQuery}
												class="focus:ring-primary w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
											/>
										</div>
										<select
											bind:value={selectedSort}
											class="focus:ring-primary rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
										>
											<option value="name-asc">Name (A-Z)</option>
											<option value="name-desc">Name (Z-A)</option>
											<option value="rarity-asc">Rarity (Low to High)</option>
											<option value="rarity-desc">Rarity (High to Low)</option>
										</select>
										<button
											type="button"
											onclick={clearFilters}
											class="hover:bg-muted rounded-md border px-3 py-2 text-sm transition-colors"
										>
											Clear All
										</button>
									</div>

									<!-- Trait Filters -->
									{#if Object.keys(allTraits).length > 0}
										<div class="space-y-3">
											<div class="text-sm font-medium">Trait Filters</div>
											<div class="flex flex-wrap gap-4">
												{#each Object.entries(allTraits) as [layer, values]}
													<div class="space-y-2">
														<div class="text-muted-foreground text-xs font-medium">{layer}</div>
														<div class="flex flex-wrap gap-1">
															{#each values as value}
																<button
																	type="button"
																	onclick={() => toggleTraitFilter(layer, value)}
																	class="rounded border px-2 py-1 text-xs transition-all {selectedTraits[
																		layer
																	]?.includes(value)
																		? 'bg-primary text-primary-foreground border-primary shadow-sm'
																		: 'hover:bg-muted border-border text-foreground'}"
																	title={selectedTraits[layer]?.includes(value)
																		? 'Remove filter'
																		: 'Filter by this trait'}
																>
																	{value}
																	{#if selectedTraits[layer]?.includes(value)}
																		<span class="ml-1 font-bold">✓</span>
																	{:else}
																		<span class="text-muted-foreground ml-1">+</span>
																	{/if}
																</button>
															{/each}
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Results Count -->
									<div class="text-muted-foreground text-sm">
										Showing {filteredNFTs.length} of {selectedCollection.totalSupply} NFTs
									</div>
								</div>
							</div>

							<!-- NFT Grid with Virtual Scrolling -->
							<div class="overflow-y-auto" style="max-height: calc(125vh - 320px);">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={6}
									itemHeight={200}
									gap={12}
									class="p-3 sm:p-4 lg:p-6"
								/>
							</div>
						{/if}
					</div>

					<!-- Right: Fixed Stats and Details Panel (30% width) -->
					<div
						class="border-border bg-background/95 fixed top-[calc(120px+144px)] right-0 h-[calc(130vh)] w-[30%] border-l backdrop-blur"
					>
						<!-- Collection Selector -->
						{#if collections.length > 1}
							<div class="border-b p-4">
								<h3 class="mb-3 font-semibold">Collections</h3>
								<div class="max-h-32 space-y-2 overflow-y-auto">
									{#each collections as collection}
										<button
											type="button"
											class="hover:bg-muted w-full rounded border p-2 text-left transition-colors {selectedCollection?.id ===
											collection.id
												? 'border-primary bg-primary/10'
												: 'border-border'}"
											onclick={() => selectCollection(collection)}
										>
											<div class="truncate text-sm font-medium">{collection.name}</div>
											<div class="text-muted-foreground text-xs">{collection.totalSupply} NFTs</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Collection Stats -->
						{#if selectedCollection}
							<div class="border-b p-4">
								<h3 class="mb-3 font-semibold">Collection Stats</h3>
								<div class="grid grid-cols-2 gap-3 text-sm">
									<div>
										<div class="text-muted-foreground">Total</div>
										<div class="font-medium">{selectedCollection.totalSupply}</div>
									</div>
									<div>
										<div class="text-muted-foreground">Rarest</div>
										<div class="font-medium">
											#{Math.min(...selectedCollection.nfts.map((n) => n.rarityRank))}
										</div>
									</div>
									<div>
										<div class="text-muted-foreground">Avg Score</div>
										<div class="font-medium">
											{(
												selectedCollection.nfts.reduce((sum, n) => sum + n.rarityScore, 0) /
												selectedCollection.nfts.length
											).toFixed(1)}
										</div>
									</div>
									<div>
										<div class="text-muted-foreground">Date</div>
										<div class="text-xs font-medium">
											{new Date(selectedCollection.generatedAt).toLocaleDateString()}
										</div>
									</div>
								</div>
							</div>
						{/if}

						<!-- NFT Details -->
						{#if selectedNFT}
							<div class="h-[calc(110vh-144px)] overflow-y-auto p-4">
								<h3 class="mb-4 font-semibold">NFT Details</h3>

								<!-- NFT Image -->
								<div
									class="bg-muted mx-auto mb-4 aspect-square max-w-[450px] overflow-hidden rounded-lg"
								>
									{#if selectedNFT.imageData && (typeof selectedNFT.imageData === 'string' || selectedNFT.imageData.byteLength > 0)}
										<img
											src={imageUrlCache.get(selectedNFT.id, selectedNFT.imageData)}
											alt={selectedNFT.name}
											class="h-full w-full object-contain"
										/>
									{:else}
										<div
											class="text-muted-foreground flex h-full w-full items-center justify-center text-sm"
										>
											No Image
										</div>
									{/if}
								</div>

								<!-- NFT Name -->
								<div class="mb-4">
									<h4 class="mb-1 text-xl font-bold">{selectedNFT.name}</h4>
									<div class="text-muted-foreground text-sm">
										Rank #{selectedNFT.rarityRank} • Score: {selectedNFT.rarityScore.toFixed(1)}
									</div>
								</div>

								<!-- NFT Description -->
								{#if selectedNFT.description}
									<div class="mb-4">
										<div class="mb-2 font-medium">Description</div>
										<p class="text-muted-foreground">{selectedNFT.description}</p>
									</div>
								{/if}

								<!-- Traits -->
								{#if selectedNFT.metadata.traits && selectedNFT.metadata.traits.length > 0}
									<div class="mb-4">
										<div class="mb-3 font-medium">Traits (click to filter)</div>
										<div class="space-y-2">
											{#each selectedNFT.metadata.traits as trait}
												{@const layer = trait.layer || (trait as any).trait_type}
												{@const traitValue = trait.trait || (trait as any).value}
												{@const isSelected = selectedTraits[layer]?.includes(traitValue)}
												<button
													type="button"
													class="flex w-full cursor-pointer items-center justify-between rounded p-2 text-left text-sm transition-all {isSelected
														? 'bg-primary text-primary-foreground ring-primary/50 shadow-md ring-2'
														: 'bg-muted/30 hover:bg-muted/50 text-foreground'}"
													onclick={() => toggleTraitFilter(layer, traitValue)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleTraitFilter(layer, traitValue);
														}
													}}
													title={isSelected
														? 'Click to remove filter'
														: 'Click to filter by this trait'}
												>
													<div class="flex items-center gap-2">
														<div
															class="h-2 w-2 rounded-full {isSelected
																? 'bg-primary-foreground'
																: 'bg-muted-foreground'}"
														></div>
														<span class="font-medium">{layer}:</span>
														<span class={isSelected ? 'text-primary-foreground' : ''}
															>{traitValue}</span
														>
													</div>
													<div class="flex items-center gap-2">
														{#if trait.rarity}
															<span
																class="{isSelected
																	? 'text-primary-foreground bg-primary-foreground/20'
																	: 'text-muted-foreground bg-background'} rounded px-2 py-1 text-xs"
																>{trait.rarity}%</span
															>
														{/if}
														{#if isSelected}
															<span class="text-primary-foreground text-xs font-bold">✓</span>
														{:else}
															<span class="text-muted-foreground text-xs">+</span>
														{/if}
													</div>
												</button>
											{/each}
										</div>
										{#if Object.keys(selectedTraits).length > 0}
											<div class="text-muted-foreground mt-3 text-xs">
												{Object.values(selectedTraits).flat().length} trait{Object.values(
													selectedTraits
												).flat().length !== 1
													? 's'
													: ''} selected
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{:else if selectedCollection}
							<div class="flex h-full items-center justify-center p-4 text-center">
								<div class="text-muted-foreground">
									<svg
										class="text-muted-foreground mx-auto h-12 w-12"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-3z"
											stroke-width="1"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<circle cx="12" cy="13" r="3" stroke-width="1" />
										<path
											d="M12 13v.01"
											stroke-width="1"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<path
											d="M16 11h.01"
											stroke-width="1"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<path
											d="M8 11h.01"
											stroke-width="1"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
									<div class="text-sm">Click an NFT to view details</div>
								</div>
							</div>
						{/if}
					</div>
					<!-- Add padding to account for fixed right panel -->
					<div class="w-[30%]"></div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Portal for mobile/tablet dropdown - placed at root level -->
	{#if sortDropdownOpen}
		<div
			class="fixed inset-0 z-[9999]"
			role="button"
			tabindex="0"
			onmousedown={() => (sortDropdownOpen = false)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					sortDropdownOpen = false;
				}
			}}
		>
			<!-- Backdrop to close dropdown when clicking outside -->
		</div>
		<div
			class="border-border fixed z-[10000] rounded-md border shadow-lg"
			style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);"
		>
			<button
				type="button"
				onclick={() => {
					selectedSort = 'name-asc';
					sortDropdownOpen = false;
				}}
				class="hover:bg-muted w-full rounded-t-md px-3 py-2 text-left text-sm {selectedSort ===
				'name-asc'
					? 'bg-primary text-primary-foreground'
					: ''}"
			>
				Name (A-Z)
			</button>
			<button
				type="button"
				onclick={() => {
					selectedSort = 'name-desc';
					sortDropdownOpen = false;
				}}
				class="hover:bg-muted w-full px-3 py-2 text-left text-sm {selectedSort === 'name-desc'
					? 'bg-primary text-primary-foreground'
					: ''}"
			>
				Name (Z-A)
			</button>
			<button
				type="button"
				onclick={() => {
					selectedSort = 'rarity-asc';
					sortDropdownOpen = false;
				}}
				class="hover:bg-muted w-full px-3 py-2 text-left text-sm {selectedSort === 'rarity-asc'
					? 'bg-primary text-primary-foreground'
					: ''}"
			>
				Rarity (Low to High)
			</button>
			<button
				type="button"
				onclick={() => {
					selectedSort = 'rarity-desc';
					sortDropdownOpen = false;
				}}
				class="hover:bg-muted w-full rounded-b-md px-3 py-2 text-left text-sm {selectedSort ===
				'rarity-desc'
					? 'bg-primary text-primary-foreground'
					: ''}"
			>
				Rarity (High to Low)
			</button>
		</div>
	{/if}
</div>
