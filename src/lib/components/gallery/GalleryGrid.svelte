<script lang="ts">
	import { onMount } from 'svelte';
	import type { GalleryNFT } from '$lib/types/gallery';
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
	import VirtualNFTGrid from './VirtualNFTGrid.svelte';

	interface Props {
		selectedNFT?: GalleryNFT | null;
		onselect?: (nft: GalleryNFT) => void;
		class?: string;
	}

	let { selectedNFT = null, onselect, class: className = '' }: Props = $props();

	let nfts = $derived(galleryStore.filteredAndSortedNFTs);
	let isLoading = $derived(galleryStore.isLoading);
	let error = $derived(galleryStore.error);

	function handleNFTClick(nft: GalleryNFT) {
		onselect?.(nft);
	}

	onMount(() => {
		// Load gallery data if not already loaded
		if (galleryStore.collections.length === 0 && !isLoading) {
			galleryStore.loadFromIndexedDB();
		}
	});
</script>

<div class="space-y-4 {className}">
	<!-- Loading State -->
	{#if isLoading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
			{#each Array(12) as _}
				<div class="space-y-3">
					<Skeleton class="aspect-[4/5] w-full rounded-lg" />
					<Skeleton class="h-4 w-3/4" />
					<Skeleton class="h-3 w-1/2" />
				</div>
			{/each}
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="text-muted-foreground mb-2 text-lg">Failed to load gallery</div>
			<div class="text-muted-foreground text-sm">{error}</div>
		</div>
	{:else if nfts.length === 0}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
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
			<div class="text-muted-foreground mb-2 text-lg">No NFTs in gallery</div>
			<div class="text-muted-foreground text-sm">Generate some NFTs first to see them here</div>
		</div>
	{:else}
		<!-- Gallery Grid with Virtual Scrolling -->
		<VirtualNFTGrid {nfts} {selectedNFT} onselect={handleNFTClick} class="min-h-[400px]" />

		<!-- Gallery Stats -->
		<div class="mt-8 border-t pt-4">
			<div class="text-muted-foreground flex flex-wrap items-center justify-between gap-4 text-sm">
				<div>Total NFTs: {nfts.length}</div>
				{#if galleryStore.selectedCollection}
					<div>Collection: {galleryStore.selectedCollection.name}</div>
				{/if}
				<div>Sorted by: {galleryStore.sortOption.replace('-', ' ')}</div>
			</div>
		</div>
	{/if}
</div>
