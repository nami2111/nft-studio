<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import GalleryImport from '$lib/components/gallery/GalleryImport.svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { GalleryNFT } from '$lib/types/gallery';

	let isLoading = $derived(galleryStore.isLoading);
	let collections = $derived(galleryStore.collections);
	let totalNFTs = $derived(collections.reduce((sum, col) => sum + col.totalSupply, 0));
	let selectedNFT = $derived(galleryStore.selectedNFT);
	let selectedCollection = $derived(galleryStore.selectedCollection || collections[0]); // Use store's selected or fallback to first
	let totalNFTsInCollection = $derived(selectedCollection?.totalSupply || 0);

	// Search and filter state
	let searchQuery = $state('');
	let selectedSort = $state<'name-asc' | 'name-desc' | 'rarity-asc' | 'rarity-desc'>('rarity-asc');
	let sortDropdownOpen = $state(false);
	let sortButtonRef = $state<HTMLButtonElement | null>(null);
	let dropdownPosition = $state({ top: 0, left: 0, width: 0 });
	let selectedTraits = $state<Record<string, string[]>>({});
	// Local filtering and sorting
	let filteredNFTs = $derived.by(() => {
		if (!selectedCollection) return [];

		let nfts = [...selectedCollection.nfts];

		// Apply search filter
		if (searchQuery) {
			const searchLower = searchQuery.toLowerCase();
			nfts = nfts.filter(
				(nft) =>
					nft.name.toLowerCase().includes(searchLower) ||
					nft.description?.toLowerCase().includes(searchLower)
			);
		}

		// Apply trait filters
		if (Object.keys(selectedTraits).length > 0) {
			nfts = nfts.filter((nft) => {
				for (const [layer, traits] of Object.entries(selectedTraits)) {
					const nftLayerTraits = nft.metadata.traits
						.filter((t) => (t.layer || (t as any).trait_type) === layer)
						.map((t) => t.trait || (t as any).value);

					if (!traits.some((trait) => nftLayerTraits.includes(trait))) {
						return false;
					}
				}
				return true;
			});
		}

		// Apply sorting
		switch (selectedSort) {
			case 'name-asc':
				nfts.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'name-desc':
				nfts.sort((a, b) => b.name.localeCompare(a.name));
				break;
			case 'rarity-asc':
				// Low to High = Common to rare (lowest score to highest score)
				nfts.sort((a, b) => a.rarityScore - b.rarityScore);
				break;
			case 'rarity-desc':
				// High to Low = Rare to common (highest score to lowest score)
				nfts.sort((a, b) => b.rarityScore - a.rarityScore);
				break;
		}

		return nfts;
	});

	// Initialize store with selected collection
	$effect(() => {
		galleryStore.setSelectedCollection(selectedCollection || null);
	});

	// Get all unique traits for filters
	let allTraits = $derived(() => {
		if (!selectedCollection) return {};

		const traits: { [layer: string]: Set<string> } = {};

		selectedCollection.nfts.forEach((nft) => {
			nft.metadata.traits?.forEach((trait) => {
				const layer = trait.layer || (trait as any).trait_type;
				const value = trait.trait || (trait as any).value;

				if (layer && value) {
					if (!traits[layer]) traits[layer] = new Set();
					traits[layer].add(value);
				}
			});
		});

		// Convert Sets to arrays
		const result: { [layer: string]: string[] } = {};
		Object.keys(traits).forEach((layer) => {
			result[layer] = Array.from(traits[layer]).sort();
		});

		return result;
	});

	
	
	// Track Object URLs for cleanup
	const objectUrls = new Set<string>();

	// Clean up Object URLs when component is destroyed
	onDestroy(() => {
		objectUrls.forEach((url) => URL.revokeObjectURL(url));
		objectUrls.clear();
	});

	function createObjectUrl(imageData: ArrayBuffer): string {
		// Try to detect the image type from the first few bytes
		const view = new Uint8Array(imageData);
		let mimeType = 'image/png'; // default

		// Check for JPEG signature (FF D8 FF)
		if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
			mimeType = 'image/jpeg';
		}
		// Check for PNG signature (89 50 4E 47)
		else if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
			mimeType = 'image/png';
		}

		const url = URL.createObjectURL(new Blob([imageData], { type: mimeType }));
		objectUrls.add(url);
		return url;
	}

	function forceClearCache() {
		console.log('Force clearing gallery cache...');
		// Clear gallery store state directly (this also handles localStorage)
		galleryStore.clearGallery();

		// Force reload the page
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

	// Clear cache on page load/reload
	onMount(() => {
		galleryStore.clearGallery();
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
	<div class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
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
			<div class="max-w-md text-center">
				<div class="mb-4 text-6xl">🖼️</div>
				<h2 class="mb-2 text-xl font-semibold">No collections yet</h2>
				<p class="text-muted-foreground mb-6">
					Generate NFTs in Generate Mode or import existing collections to get started.
				</p>
				<GalleryImport />
			</div>
		</div>
	{:else}
		<!-- Mobile Layout -->
		<div class="lg:hidden">
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
							<div class="flex gap-2 relative">
								<!-- Custom Sort Dropdown -->
								<div class="flex-1 relative sort-dropdown-container">
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
									class="hover:bg-muted rounded-md border px-3 py-2 text-xs transition-colors whitespace-nowrap"
								>
									Clear
								</button>
							</div>
						</div>

						<!-- Trait Filters - Mobile -->
						{#if Object.keys(allTraits).length > 0}
							<div class="space-y-2">
								<div class="text-xs font-medium">Filters</div>
								<div class="max-h-32 overflow-y-auto space-y-2">
									{#each Object.entries(allTraits) as [layer, values]}
										<div>
											<div class="text-muted-foreground text-xs font-medium mb-1">{layer}</div>
											<div class="flex flex-wrap gap-1">
												{#each values.slice(0, 6) as value}
													<button
														type="button"
														onclick={() => toggleTraitFilter(layer, value)}
														class="rounded border px-2 py-1 text-xs transition-all {selectedTraits[layer]?.includes(value)
															? 'bg-primary text-primary-foreground border-primary shadow-sm'
															: 'hover:bg-muted border-border text-foreground'}"
														title="{selectedTraits[layer]?.includes(value) ? 'Remove filter' : 'Filter by this trait'}"
													>
														{value}
														{#if selectedTraits[layer]?.includes(value)}
															<span class="ml-1 font-bold">✓</span>
														{:else}
															<span class="ml-1 text-muted-foreground">+</span>
														{/if}
													</button>
												{/each}
												{#if values.length > 6}
													<button
														type="button"
														class="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
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

				<!-- NFT Grid - Mobile -->
				<div class="overflow-y-auto p-2" style="max-height: calc(100vh - 300px);">
					<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
						{#each filteredNFTs as nft}
							<button
								type="button"
								class="group bg-muted/50 hover:border-primary relative aspect-square cursor-pointer overflow-hidden rounded border transition-colors {selectedNFT?.id === nft.id
									? 'ring-primary ring-2'
									: ''}"
								onclick={() => selectNFT(nft)}
							>
								{#if nft.imageData && nft.imageData.byteLength > 0}
									<img
										src={createObjectUrl(nft.imageData)}
										alt={nft.name}
										class="h-full w-full object-cover"
										onerror={(e) => {
											const target = e.target as HTMLImageElement;
											target.style.display = 'none';
											target.nextElementSibling &&
												((target.nextElementSibling as HTMLElement).style.display = 'flex');
										}}
									/>
									<div
										class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-1 text-xs"
										style="display: none;"
									>
										<div class="text-center">
											<div>✕</div>
										</div>
									</div>
								{:else}
									<div
										class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs"
									>
										<div class="text-center">
											<div>No Img</div>
										</div>
									</div>
								{/if}
								<div
									class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
								>
									<div class="absolute right-0 bottom-0 left-0 p-1 text-white">
										<div class="truncate text-xs font-medium">{nft.name}</div>
										<div class="text-xs opacity-80">#{nft.rarityRank}</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Mobile NFT Details Panel -->
				{#if selectedNFT}
					<div class="fixed bottom-0 left-0 right-0 bg-white/95 border-t backdrop-blur p-3 max-h-[40vh] overflow-y-auto">
						<div class="flex justify-between items-center mb-2">
							<h3 class="text-sm font-semibold">NFT Details</h3>
							<button
								type="button"
								onclick={() => selectedNFT = null}
								class="text-muted-foreground hover:text-foreground text-sm"
							>
								✕
							</button>
						</div>

						<div class="flex gap-3">
							<!-- NFT Image - Mobile -->
							<div class="flex-shrink-0 w-24 h-24 bg-muted rounded overflow-hidden">
								{#if selectedNFT.imageData && selectedNFT.imageData.byteLength > 0}
									<img
										src={createObjectUrl(selectedNFT.imageData)}
										alt={selectedNFT.name}
										class="h-full w-full object-contain"
									/>
								{:else}
									<div class="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
										No Img
									</div>
								{/if}
							</div>

							<!-- NFT Info - Mobile -->
							<div class="flex-1 min-w-0">
								<h4 class="text-sm font-bold truncate">{selectedNFT.name}</h4>
								<div class="text-xs text-muted-foreground">
									Rank #{selectedNFT.rarityRank} • Score: {selectedNFT.rarityScore.toFixed(1)}
								</div>
								{#if selectedNFT.description}
									<p class="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedNFT.description}</p>
								{/if}

								<!-- Traits - Mobile -->
								{#if selectedNFT.metadata.traits && selectedNFT.metadata.traits.length > 0}
									<div class="mt-2">
										<div class="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
											{#each selectedNFT.metadata.traits as trait}
												{@const layer = trait.layer || (trait as any).trait_type}
												{@const traitValue = trait.trait || (trait as any).value}
												{@const isSelected = selectedTraits[layer]?.includes(traitValue)}
												<button
													type="button"
													class="rounded-full px-2 py-0.5 text-xs cursor-pointer transition-all flex-shrink-0 {isSelected
														? 'bg-primary text-primary-foreground shadow-sm'
														: 'bg-muted/70 hover:bg-muted text-foreground'}"
													onclick={() => toggleTraitFilter(layer, traitValue)}
													title="{isSelected ? 'Remove filter' : 'Filter by this trait'}"
												>
													{traitValue}
													{#if isSelected}
														<span class="ml-1 font-bold">✓</span>
													{:else}
														<span class="ml-1 text-muted-foreground">+</span>
													{/if}
												</button>
											{/each}
										</div>
										{#if Object.keys(selectedTraits).length > 0}
											<div class="mt-1 text-xs text-muted-foreground">
												{Object.values(selectedTraits).flat().length} filter{Object.values(selectedTraits).flat().length !== 1 ? 's' : ''} active
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

		<!-- Desktop Layout -->
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
																title="{selectedTraits[layer]?.includes(value) ? 'Remove filter' : 'Filter by this trait'}"
															>
																{value}
																{#if selectedTraits[layer]?.includes(value)}
																	<span class="ml-1 font-bold">✓</span>
																{:else}
																	<span class="ml-1 text-muted-foreground">+</span>
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

						<!-- NFT Grid (scrollable) -->
						<div class="overflow-y-auto p-3 sm:p-4 lg:p-6" style="max-height: calc(125vh - 320px);">
							<div
								class="grid grid-cols-4 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8"
							>
								{#each filteredNFTs as nft}
									<button
										type="button"
										class="group bg-muted/50 hover:border-primary relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg border transition-colors {selectedNFT?.id ===
										nft.id
											? 'ring-primary ring-2'
											: ''}"
										onclick={() => selectNFT(nft)}
									>
										{#if nft.imageData && nft.imageData.byteLength > 0}
											<img
												src={createObjectUrl(nft.imageData)}
												alt={nft.name}
												class="h-full w-full object-cover"
												onerror={(e) => {
													const target = e.target as HTMLImageElement;
													target.style.display = 'none';
													target.nextElementSibling &&
														((target.nextElementSibling as HTMLElement).style.display = 'flex');
												}}
											/>
											<div
												class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-2 text-xs"
												style="display: none;"
											>
												<div class="text-center">
													<div>Image Error</div>
												</div>
											</div>
										{:else}
											<div
												class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center p-2 text-xs"
											>
												<div class="text-center">
													<div>No Image</div>
												</div>
											</div>
										{/if}
										<div
											class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
										>
											<div class="absolute right-0 bottom-0 left-0 p-1 text-white">
												<div class="truncate text-xs font-medium">{nft.name}</div>
												<div class="text-xs opacity-80">#{nft.rarityRank}</div>
											</div>
										</div>
									</button>
								{/each}
							</div>
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
								{#if selectedNFT.imageData && selectedNFT.imageData.byteLength > 0}
									<img
										src={createObjectUrl(selectedNFT.imageData)}
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
												class="flex items-center justify-between rounded p-2 text-sm cursor-pointer transition-all w-full text-left {isSelected
													? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/50'
													: 'bg-muted/30 hover:bg-muted/50 text-foreground'}"
												onclick={() => toggleTraitFilter(layer, traitValue)}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														toggleTraitFilter(layer, traitValue);
													}
												}}
												title="{isSelected ? 'Click to remove filter' : 'Click to filter by this trait'}"
											>
												<div class="flex items-center gap-2">
													<div class="h-2 w-2 rounded-full {isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground'}"></div>
													<span class="font-medium">{layer}:</span>
													<span class="{isSelected ? 'text-primary-foreground' : ''}">{traitValue}</span>
												</div>
												<div class="flex items-center gap-2">
													{#if trait.rarity}
														<span class="{isSelected ? 'text-primary-foreground bg-primary-foreground/20' : 'text-muted-foreground bg-background'} rounded px-2 py-1 text-xs"
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
										<div class="mt-3 text-xs text-muted-foreground">
											{Object.values(selectedTraits).flat().length} trait{Object.values(selectedTraits).flat().length !== 1 ? 's' : ''} selected
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{:else if selectedCollection}
						<div class="flex h-full items-center justify-center p-4 text-center">
							<div class="text-muted-foreground">
								<div class="mb-2 text-4xl">📸</div>
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

	<!-- Portal for mobile dropdown - placed at root level -->
	{#if sortDropdownOpen}
		<div class="fixed inset-0 z-[9999]" onmousedown={() => sortDropdownOpen = false}>
			<!-- Backdrop to close dropdown when clicking outside -->
		</div>
		<div
			class="fixed z-[10000] rounded-md border border-border shadow-lg"
			style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; width: {dropdownPosition.width}px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);"
		>
			<button
				type="button"
				onclick={() => { selectedSort = 'name-asc'; sortDropdownOpen = false; }}
				class="w-full rounded-t-md px-3 py-2 text-left text-sm hover:bg-muted {selectedSort === 'name-asc' ? 'bg-primary text-primary-foreground' : ''}"
			>
				Name (A-Z)
			</button>
			<button
				type="button"
				onclick={() => { selectedSort = 'name-desc'; sortDropdownOpen = false; }}
				class="w-full px-3 py-2 text-left text-sm hover:bg-muted {selectedSort === 'name-desc' ? 'bg-primary text-primary-foreground' : ''}"
			>
				Name (Z-A)
			</button>
			<button
				type="button"
				onclick={() => { selectedSort = 'rarity-asc'; sortDropdownOpen = false; }}
				class="w-full px-3 py-2 text-left text-sm hover:bg-muted {selectedSort === 'rarity-asc' ? 'bg-primary text-primary-foreground' : ''}"
			>
				Rarity (Low to High)
			</button>
			<button
				type="button"
				onclick={() => { selectedSort = 'rarity-desc'; sortDropdownOpen = false; }}
				class="w-full rounded-b-md px-3 py-2 text-left text-sm hover:bg-muted {selectedSort === 'rarity-desc' ? 'bg-primary text-primary-foreground' : ''}"
			>
				Rarity (High to Low)
			</button>
		</div>
	{/if}
</div>
