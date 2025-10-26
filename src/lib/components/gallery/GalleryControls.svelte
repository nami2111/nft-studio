<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import type { GalleryCollection, GallerySortOption } from '$lib/types/gallery';
	import Input from '$lib/components/ui/input/input.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Card from '$lib/components/ui/card/card.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let searchQuery = $state(galleryStore.filterOptions.search || '');
	let selectedCollection = $state(galleryStore.selectedCollection?.id || '');
	let sortOption = $state(galleryStore.sortOption);

	const collections = $derived(galleryStore.collections);
	const sortOptions: { value: GallerySortOption; label: string }[] = [
		{ value: 'newest', label: 'Newest First' },
		{ value: 'oldest', label: 'Oldest First' },
		{ value: 'name-asc', label: 'Name (A-Z)' },
		{ value: 'name-desc', label: 'Name (Z-A)' },
		{ value: 'rarity-asc', label: 'Most Rare' },
		{ value: 'rarity-desc', label: 'Least Rare' }
	];

	// Handle search with debouncing
	let searchTimeout: number;
	function handleSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;

		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			galleryStore.setFilterOptions({ search: searchQuery || undefined });
		}, 300);
	}

	function handleCollectionChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const collectionId = target.value;
		selectedCollection = collectionId;

		const collection = collectionId ? collections.find((c) => c.id === collectionId) || null : null;
		galleryStore.setSelectedCollection(collection);
	}

	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		sortOption = target.value as GallerySortOption;
		galleryStore.setSortOption(sortOption);
	}

	function clearFilters() {
		searchQuery = '';
		selectedCollection = '';
		sortOption = 'newest';
		galleryStore.setFilterOptions({});
		galleryStore.setSelectedCollection(null);
		galleryStore.setSortOption('newest');
	}

	function showAllCollections() {
		selectedCollection = '';
		galleryStore.setSelectedCollection(null);
	}
</script>

<Card class="p-4 {className}">
	<div class="space-y-4">
		<!-- Search Bar -->
		<div>
			<Input
				type="text"
				placeholder="Search NFTs by name or description..."
				value={searchQuery}
				oninput={handleSearch}
				class="w-full"
			/>
		</div>

		<!-- Controls Row -->
		<div class="flex flex-wrap gap-3">
			<!-- Collection Filter -->
			<div class="min-w-0 flex-1">
				<select
					bind:value={selectedCollection}
					onchange={handleCollectionChange}
					class="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<option value="">All Collections</option>
					{#each collections as collection}
						<option value={collection.id}>
							{collection.name} ({collection.totalSupply} NFTs)
						</option>
					{/each}
				</select>
			</div>

			<!-- Sort Options -->
			<div class="min-w-0 flex-1">
				<select
					bind:value={sortOption}
					onchange={handleSortChange}
					class="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					{#each sortOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Clear Filters -->
			<Button variant="outline" size="sm" onclick={clearFilters}>Clear</Button>
		</div>

		<!-- Active Filters Display -->
		<div class="text-muted-foreground flex flex-wrap gap-2 text-xs">
			{#if searchQuery}
				<span class="bg-secondary rounded px-2 py-1">
					Search: "{searchQuery}"
				</span>
			{/if}
			{#if selectedCollection}
				<span class="bg-secondary rounded px-2 py-1">
					Collection: {collections.find((c) => c.id === selectedCollection)?.name}
				</span>
			{/if}
			<span class="bg-secondary rounded px-2 py-1">
				Sort: {sortOptions.find((o) => o.value === sortOption)?.label}
			</span>
		</div>
	</div>
</Card>
