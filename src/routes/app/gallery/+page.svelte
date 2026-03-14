<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import GalleryImport from '$lib/components/gallery/GalleryImport.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { GalleryNFT, GalleryCollection, GallerySortOption } from '$lib/types/gallery';

	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import SimpleVirtualGrid from '$lib/components/gallery/SimpleVirtualGrid.svelte';
	import CollectionStats from '$lib/components/gallery/CollectionStats.svelte';
	import NFTDetail from '$lib/components/gallery/NFTDetail.svelte';
	import { Button } from '$components/ui/button/index.js';

	const isLoading = $derived(galleryStore.isLoading);
	const collections = $derived(galleryStore.collections);
	const totalNFTs = $derived(collections.reduce((sum, col) => sum + col.totalSupply, 0));
	const selectedNFT = $derived(galleryStore.selectedNFT);

	// The active collection from the store, with a safe fallback in the template
	const selectedCollection = $derived(galleryStore.selectedCollection);

	// Use store state for filters
	let searchQuery = $state(galleryStore.filterOptions.search || '');
	let selectedSort = $state<GallerySortOption>(
		(galleryStore.sortOption as GallerySortOption) || 'rarity-asc'
	);
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
	const filteredNFTs = $derived(galleryStore.filteredAndSortedNFTs);

	// No longer syncing selectedCollection back to store via $effect to avoid loops.
	// We handle initial selection in an effect that only runs when collections load.
	$effect(() => {
		if (collections.length > 0 && !galleryStore.selectedCollection) {
			untrack(() => {
				galleryStore.setSelectedCollection(collections[0]);
				// Auto-select first NFT to trigger proper layout calculation
				if (collections[0].nfts.length > 0) {
					galleryStore.setSelectedNFT(collections[0].nfts[0]);
				}
			});
		}
	});

	// Track Object URLs for cleanup
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const objectUrls = new Set<string>();

	// Clean up Object URLs when component is destroyed
	onDestroy(() => {
		objectUrls.forEach((url) => URL.revokeObjectURL(url));
		objectUrls.clear();
	});

	function forceClearCache() {
		console.log('Force clearing gallery cache...');
		galleryStore.clearGallery();
		imageUrlCache.clear();
		window.location.reload();
	}

	function selectNFT(nft: GalleryNFT) {
		galleryStore.setSelectedNFT(nft);
	}

	function selectCollection(collection: GalleryCollection) {
		galleryStore.setSelectedCollection(collection);
	}

	// Toggle trait filter when clicking on traits in NFT details
	function toggleTraitFilter(layer: string, value: string) {
		const current = selectedTraits[layer] || [];
		const index = current.indexOf(value);

		if (index > -1) {
			// Remove trait if already selected
			const filtered = current.filter((v) => v !== value);
			if (filtered.length === 0) {
				delete selectedTraits[layer];
			} else {
				selectedTraits[layer] = filtered;
			}
		} else {
			// Add trait if not selected
			selectedTraits[layer] = [...current, value];
		}
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedSort = 'rarity-asc';
		selectedTraits = {};
	}

	onMount(() => {
		// DANGER: Removed galleryStore.clearGallery() which was deleting all user data!
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

<div class="bg-background flex min-h-[100dvh] flex-col overflow-visible">
	{#if isLoading}
		<!-- Loading State -->
		<div class="flex min-h-[60vh] items-center justify-center px-4">
			<div class="text-center">
				<div class="text-muted-foreground mb-2 text-lg">Loading gallery...</div>
				<div class="bg-muted mx-auto h-2 w-48 max-w-sm animate-pulse rounded-full"></div>
			</div>
		</div>
	{:else}
		<!-- Gallery Header -->
		<header
			class="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex-none border-b backdrop-blur"
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
					<div
						class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm"
					>
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
		</header>

		<main class="flex-1 overflow-visible">
			<!-- Main Content -->
			{#if collections.length === 0}
				<!-- Empty State with Import -->
				<div class="flex min-h-[calc(100dvh-200px)] items-center justify-center px-4 pb-24">
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
				<div class="flex h-[100dvh] flex-col sm:hidden">
					{#if selectedCollection}
						<!-- Collection Header - Mobile -->
						<div class="bg-background/95 shrink-0 border-b p-4 backdrop-blur">
							<h2 class="text-lg font-bold">{selectedCollection.name}</h2>
							<div class="text-muted-foreground mt-1 text-xs">
								{selectedCollection.totalSupply} NFTs • {new Date(
									selectedCollection.generatedAt
								).toLocaleDateString()}
							</div>
						</div>

						<!-- Search and Filters - Mobile -->
						<div class="bg-background/95 border-b p-3 backdrop-blur">
							<div class="flex flex-col gap-3">
								<input
									type="text"
									placeholder="Search NFTs..."
									bind:value={searchQuery}
									class="focus:ring-primary/20 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
								/>
								<div class="flex gap-2">
									<div class="sort-dropdown-container relative flex-1">
										<button
											bind:this={sortButtonRef}
											type="button"
											onclick={toggleSortDropdown}
											class="focus:ring-primary/20 flex w-full justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
										>
											<span class="truncate">
												{#if selectedSort === 'name-asc'}Name (A-Z)
												{:else if selectedSort === 'name-desc'}Name (Z-A)
												{:else if selectedSort === 'rarity-asc'}Rarity (High)
												{:else if selectedSort === 'rarity-desc'}Rarity (Low)
												{/if}
											</span>
											<span class="text-muted-foreground ml-2">▼</span>
										</button>
									</div>
									<Button variant="outline" size="sm" onclick={clearFilters}>Clear</Button>
								</div>
							</div>
						</div>

						<!-- NFT Grid -->
						<div class="relative min-h-0 flex-1 pb-32">
							<SimpleVirtualGrid
								nfts={filteredNFTs}
								{selectedNFT}
								onselect={selectNFT}
								columns={3}
								itemHeight={120}
								gap={8}
								class="h-full"
							/>
						</div>

						<!-- Mobile Details Sheet -->
						{#if selectedNFT}
							<div
								class="bg-background/95 pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[60vh] overflow-y-auto border-t p-4 shadow-2xl backdrop-blur-xl"
							>
								<div class="mb-4 flex items-center justify-between">
									<h3 class="font-bold">NFT Details</h3>
									<button
										type="button"
										onclick={() => galleryStore.setSelectedNFT(null)}
										class="bg-muted hover:bg-muted/80 rounded-full p-1"
										aria-label="Close"
									>
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"
											><path
												fill-rule="evenodd"
												d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
												clip-rule="evenodd"
											/></svg
										>
									</button>
								</div>
								<NFTDetail
									{selectedNFT}
									hideCard
									{selectedTraits}
									ontraitclick={toggleTraitFilter}
								/>
							</div>
						{/if}
					{/if}
				</div>

				<!-- Mobile Landscape / Small Tablet (640px to 767px) -->
				<div class="hidden h-full sm:flex md:hidden">
					{#if selectedCollection}
						<div class="flex flex-1 flex-col overflow-hidden pb-24">
							<div class="bg-background/95 border-b p-4 backdrop-blur">
								<h2 class="truncate text-xl font-bold">{selectedCollection.name}</h2>
								<div class="flex items-center gap-2">
									<input
										type="text"
										placeholder="Search..."
										bind:value={searchQuery}
										class="focus:ring-primary/20 mt-2 flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
									/>
									<Button variant="outline" size="sm" class="mt-2" onclick={clearFilters}
										>Reset</Button
									>
								</div>
							</div>
							<div class="relative min-h-0 flex-1">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={4}
									itemHeight={160}
									gap={10}
									class="h-full"
								/>
							</div>
						</div>
						<aside class="bg-card/50 w-72 overflow-y-auto border-l backdrop-blur">
							<CollectionStats collection={selectedCollection} class="bg-transparent" />
							<NFTDetail
								{selectedNFT}
								hideCard
								class="p-4"
								{selectedTraits}
								ontraitclick={toggleTraitFilter}
							/>
						</aside>
					{/if}
				</div>

				<!-- Tablet Layout (md: 768px to lg: 1023px) -->
				<div class="hidden h-full md:flex lg:hidden">
					{#if selectedCollection}
						<div class="flex flex-1 flex-col overflow-hidden">
							<div class="bg-background/95 border-b p-5 backdrop-blur">
								<div class="flex items-center justify-between">
									<h2 class="text-2xl font-bold">{selectedCollection.name}</h2>
									<div class="flex gap-2">
										<input
											type="text"
											placeholder="Search NFTs..."
											bind:value={searchQuery}
											class="focus:ring-primary/20 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
										/>
										<Button variant="outline" onclick={clearFilters}>Reset</Button>
									</div>
								</div>
							</div>
							<div class="relative min-h-0 flex-1">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={5}
									itemHeight={180}
									gap={12}
									class="h-full"
								/>
							</div>
						</div>
						<aside class="bg-card/50 w-80 overflow-y-auto border-l backdrop-blur">
							<CollectionStats collection={selectedCollection} class="bg-transparent" />
							<NFTDetail
								{selectedNFT}
								hideCard
								class="p-5"
								{selectedTraits}
								ontraitclick={toggleTraitFilter}
							/>
						</aside>
					{/if}
				</div>

				<!-- Desktop Layout (1024px and above) -->
				<div class="hidden h-full lg:flex">
					<!-- Left: NFT Grid -->
					<div class="flex flex-1 flex-col overflow-hidden">
						{#if selectedCollection}
							<!-- Collection Header with Stats -->
							<div class="bg-muted/20 border-b p-6 backdrop-blur-sm">
								<div class="flex items-center justify-between">
									<div>
										<h2 class="text-3xl font-extrabold tracking-tight">
											{selectedCollection.name}
										</h2>
										<p class="text-muted-foreground mt-1">{selectedCollection.description}</p>
									</div>
									<div class="flex gap-4">
										<div class="text-right">
											<div
												class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
											>
												NFTs
											</div>
											<div class="text-xl font-black">{selectedCollection.totalSupply}</div>
										</div>
										<div class="text-right">
											<div
												class="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
											>
												Format
											</div>
											<div class="text-xl font-black">
												{selectedCollection.nfts[0]?.imageFormat?.toUpperCase() || 'PNG'}
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- Search and Filters -->
							<div class="bg-background/95 border-b p-4 backdrop-blur">
								<div class="flex flex-col gap-4">
									<div class="flex items-center gap-3">
										<div class="relative flex-1">
											<svg
												class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												><path
													d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												/></svg
											>
											<input
												type="text"
												placeholder="Search by name or trait..."
												bind:value={searchQuery}
												class="bg-muted/30 focus:bg-background focus:ring-primary/20 w-full rounded-lg border py-2 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:outline-none"
											/>
										</div>
										<select
											bind:value={selectedSort}
											class="bg-muted/30 focus:bg-background focus:ring-primary/20 rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
										>
											<option value="rarity-asc">Rarity: High to Low</option>
											<option value="rarity-desc">Rarity: Low to High</option>
											<option value="name-asc">Name: A-Z</option>
											<option value="name-desc">Name: Z-A</option>
										</select>
										<Button
											variant="ghost"
											size="sm"
											onclick={clearFilters}
											class="text-muted-foreground hover:text-foreground text-xs font-semibold tracking-wider uppercase"
										>
											Reset
										</Button>
									</div>
								</div>
							</div>

							<!-- NFT Grid with Virtual Scrolling -->
							<div class="scrollbar-gutter-stable bg-muted/5 relative min-h-0 flex-1">
								<SimpleVirtualGrid
									nfts={filteredNFTs}
									{selectedNFT}
									onselect={selectNFT}
									columns={6}
									itemHeight={220}
									gap={16}
									class="h-full p-6"
								/>
							</div>
						{/if}
					</div>

					<!-- Right: Fixed Stats and Details Sidebar -->
					<aside class="bg-card/50 flex w-[30%] flex-col overflow-hidden border-l backdrop-blur-md">
						<!-- Collections Selector -->
						{#if collections.length > 1}
							<div class="border-b p-4">
								<label
									for="collection-select"
									class="text-muted-foreground mb-2 block text-[10px] font-bold tracking-widest uppercase"
									>Switch Collection</label
								>
								<select
									id="collection-select"
									class="bg-muted/30 focus:ring-primary/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
									onchange={(e) => {
										const col = collections.find(
											(c) => c.id === (e.target as HTMLSelectElement).value
										);
										if (col) selectCollection(col);
									}}
									value={selectedCollection?.id}
								>
									{#each collections as collection (collection.id)}
										<option value={collection.id}>{collection.name}</option>
									{/each}
								</select>
							</div>
						{/if}

						<!-- Scrollable Sidebar Content -->
						<div class="flex-1 overflow-y-auto">
							{#if selectedCollection}
								<CollectionStats collection={selectedCollection} class="bg-transparent" />
							{/if}
							<NFTDetail
								{selectedNFT}
								hideCard
								class="p-6"
								{selectedTraits}
								ontraitclick={toggleTraitFilter}
							/>
						</div>
					</aside>
				</div>
			{/if}
		</main>
	{/if}

	<!-- Portal for mobile/tablet dropdown - placed at root level -->
	{#if sortDropdownOpen}
		<div
			class="fixed inset-0 z-9999"
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
			class="border-border fixed z-10000 rounded-md border shadow-lg"
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
