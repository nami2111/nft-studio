<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import GalleryImport from '$lib/components/gallery/GalleryImport.svelte';
	import { onMount, untrack } from 'svelte';
	import type { GalleryItem, GalleryCollection, GallerySortOption } from '$lib/types/gallery';

	import Icon from '$components/shared/Icon.svelte';
	import { Image01Icon, Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';

	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import SimpleVirtualGrid from '$lib/components/gallery/SimpleVirtualGrid.svelte';
	import CollectionStats from '$lib/components/gallery/CollectionStats.svelte';
	import ItemDetail from '$lib/components/gallery/ItemDetail.svelte';
	import { Button } from '$lib/components/ui/button';
	import { clearAllCollections } from '$lib/utils/gallery-db';

	const isLoading = $derived(galleryStore.isLoading);
	const collections = $derived(galleryStore.collections);
	const totalItems = $derived(collections.reduce((sum, col) => sum + col.totalSupply, 0));
	const selectedItem = $derived(galleryStore.selectedItem);
	const selectedCollection = $derived(galleryStore.selectedCollection);

	// Use store state for filters
	let searchQuery = $state(galleryStore.filterOptions.search || '');
	let selectedSort = $state<GallerySortOption>(
		(galleryStore.sortOption as GallerySortOption) || 'rarity-asc'
	);
	let selectedTraits = $state<Record<string, string[]>>(
		galleryStore.filterOptions.selectedTraits || {}
	);

	// Sync local filter state to store
	$effect(() => {
		const search = $state.snapshot(searchQuery);
		const sort = $state.snapshot(selectedSort);
		const traits = $state.snapshot(selectedTraits);
		untrack(() => {
			galleryStore.setFilterOptions({ search, selectedTraits: traits });
			galleryStore.setSortOption(sort);
		});
	});

	// Responsive grid parameters derived from viewport width
	let viewportWidth = $state(0);

	$effect(() => {
		viewportWidth = window.innerWidth;
		const handleResize = () => (viewportWidth = window.innerWidth);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	const gridParams = $derived.by(() => {
		if (viewportWidth < 640) return { columns: 3, itemHeight: 120, gap: 8 };
		if (viewportWidth < 768) return { columns: 4, itemHeight: 160, gap: 10 };
		if (viewportWidth < 1024) return { columns: 5, itemHeight: 180, gap: 12 };
		if (viewportWidth < 1440) return { columns: 6, itemHeight: 220, gap: 14 };
		return { columns: 7, itemHeight: 240, gap: 16 };
	});

	// Use store's optimized filtering and sorting
	const filteredItems = $derived(galleryStore.filteredAndSortedItems);

	// Auto-select first collection when collections load
	$effect(() => {
		if (collections.length > 0 && !galleryStore.selectedCollection) {
			untrack(() => {
				galleryStore.setSelectedCollection(collections[0]);
				if (collections[0].items.length > 0) {
					galleryStore.setSelectedItem(collections[0].items[0]);
				}
			});
		}
	});

	function handleSelectItem(item: GalleryItem) {
		galleryStore.setSelectedItem(item);
	}

	function handleSelectCollection(collection: GalleryCollection) {
		galleryStore.setSelectedCollection(collection);
	}

	function toggleTraitFilter(layer: string, value: string) {
		const current = selectedTraits[layer] || [];
		const index = current.indexOf(value);
		if (index > -1) {
			const filtered = current.filter((v) => v !== value);
			if (filtered.length === 0) delete selectedTraits[layer];
			else selectedTraits[layer] = filtered;
		} else {
			selectedTraits[layer] = [...current, value];
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedSort = 'rarity-asc';
		selectedTraits = {};
	}

	function forceClearCache() {
		imageUrlCache.clear();
		galleryStore.clearGallery();
		window.location.reload();
	}

	onMount(() => {
		clearAllCollections();
	});
</script>

<svelte:head>
	<title>GNStudio Gallery</title>
	<meta name="description" content="Browse, filter, and explore your generated collections in the GNStudio gallery." />
</svelte:head>

<div class="bg-background flex min-h-[100dvh] flex-col">
	<!-- Gallery Header -->
	<header class="border-border bg-background flex-none border-b-2">
		<div class="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-5">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-foreground text-2xl font-bold sm:text-3xl">Gallery</h1>
					<p class="text-muted-foreground mt-1 text-sm">
						View and manage your generated collections
					</p>
				</div>
				<div class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
					<div>
						<span class="text-foreground font-medium">{totalItems}</span> Total Items
					</div>
					<div>
						<span class="text-foreground font-medium">{collections.length}</span> Collections
					</div>
					<button
						type="button"
						class="text-destructive text-xs underline hover:opacity-80"
						onclick={forceClearCache}
					>
						Clear Cache
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="flex flex-1 flex-col overflow-hidden">
		{#if isLoading || collections.length === 0}
			<div class="flex min-h-[calc(100dvh-200px)] items-center justify-center px-4 pb-24">
				<div class="w-full max-w-4xl text-center">
					{#if !isLoading}
						<Icon icon={Image01Icon} class="text-muted-foreground mx-auto h-16 w-16" />
						<h2 class="mb-2 text-xl font-semibold">No collections yet</h2>
						<p class="text-muted-foreground mb-6">
							Generate in Generate Mode or import existing collections to get started.
						</p>
					{/if}
					<GalleryImport />
				</div>
			</div>
		{:else}
			<!-- Responsive Layout -->
			<div class="flex flex-1 flex-col overflow-hidden md:flex-row">
				<!-- Left: Collection Content + Grid -->
				<div class="flex flex-1 flex-col overflow-hidden">
					{#if selectedCollection}
						<!-- Collection Header + Search Bar -->
						<div class="border-border bg-background shrink-0 border-b-2 p-4">
							<div class="flex flex-col gap-3">
								<div class="flex items-center justify-between">
									<div class="min-w-0 flex-1">
										<h2 class="truncate text-lg font-bold sm:text-xl lg:text-2xl">
											{selectedCollection.name}
										</h2>
										<p class="text-muted-foreground mt-0.5 text-xs">
											{selectedCollection.totalSupply} items &middot; {new Date(
												selectedCollection.generatedAt
											).toLocaleDateString()}
										</p>
									</div>
									{#if collections.length > 1}
										<select
											class="input-brutalist hidden h-9 w-48 text-xs md:block"
											onchange={(e) => {
												const col = collections.find(
													(c) => c.id === (e.target as HTMLSelectElement).value
												);
												if (col) handleSelectCollection(col);
											}}
											value={selectedCollection.id}
										>
											{#each collections as collection (collection.id)}
												<option value={collection.id}>{collection.name}</option>
											{/each}
										</select>
									{/if}
								</div>

								<!-- Search + Sort + Reset -->
								<div class="flex flex-col gap-2 sm:flex-row">
									<div class="relative flex-1">
										<Icon
											icon={Search01Icon}
											class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
										/>
										<input
											type="text"
											placeholder="Search by name or trait..."
											bind:value={searchQuery}
											class="input-brutalist pl-10 text-sm"
										/>
									</div>
									<select
										bind:value={selectedSort}
										class="input-brutalist w-full text-sm sm:w-44"
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
										class="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold tracking-wider uppercase"
									>
										Reset
									</Button>
								</div>
							</div>
						</div>

						<!-- Virtual Grid -->
						<div class="bg-muted/5 relative min-h-0 flex flex-col flex-1 overflow-hidden">
							<SimpleVirtualGrid
								items={filteredItems}
								{selectedItem}
								onselect={handleSelectItem}
								columns={gridParams.columns}
								itemHeight={gridParams.itemHeight}
								gap={gridParams.gap}
								class="pb-32 md:pb-0"
							/>
						</div>
					{/if}
				</div>

				<!-- Right: Details Sidebar (md+) / Bottom Sheet (mobile) -->
				{#if selectedItem}
					<!-- Mobile: Bottom sheet -->
					<aside
						class="card-brutalist border-foreground pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[65vh] overflow-y-auto border-t-4 bg-card p-4 shadow-2xl md:hidden"
					>
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-bold">Item Details</h3>
							<button
								type="button"
								onclick={() => galleryStore.setSelectedItem(null)}
								class="bg-muted hover:bg-muted/80 rounded-full p-1"
								aria-label="Close details"
							>
								<Icon icon={Cancel01Icon} class="h-5 w-5" />
							</button>
						</div>
						<ItemDetail
							{selectedItem}
							hideCard
							{selectedTraits}
							ontraitclick={toggleTraitFilter}
							totalSupply={selectedCollection?.totalSupply}
						/>
					</aside>

					<!-- Desktop: Sidebar -->
					<aside
						class="card-brutalist border-foreground hidden w-[30%] min-w-[320px] max-w-[420px] flex-col overflow-hidden border-l-2 md:flex"
					>
						{#if collections.length > 1}
							<div class="border-border shrink-0 border-b-2 p-4">
								<label
									for="collection-select-desktop"
									class="text-muted-foreground mb-2 block text-[10px] font-bold tracking-widest uppercase"
								>
									Switch Collection
								</label>
								<select
									id="collection-select-desktop"
									class="input-brutalist text-sm"
									onchange={(e) => {
										const col = collections.find(
											(c) => c.id === (e.target as HTMLSelectElement).value
										);
										if (col) handleSelectCollection(col);
									}}
									value={selectedCollection?.id}
								>
									{#each collections as collection (collection.id)}
										<option value={collection.id}>{collection.name}</option>
									{/each}
								</select>
							</div>
						{/if}

						<div class="flex-1 overflow-y-auto">
							{#if selectedCollection}
								<CollectionStats collection={selectedCollection} class="bg-transparent" />
							{/if}
							<ItemDetail
								{selectedItem}
								hideCard
								class="p-6"
								{selectedTraits}
								ontraitclick={toggleTraitFilter}
								totalSupply={selectedCollection?.totalSupply}
							/>
						</div>
					</aside>
				{/if}
			</div>
		{/if}
	</main>
</div>
