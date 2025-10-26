<script lang="ts">
	import { onMount } from 'svelte';
	import type { GalleryNFT } from '$lib/types/gallery';
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import Card from '$lib/components/ui/card/card.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';

	interface Props {
		selectedNFT?: GalleryNFT | null;
		onselect?: (nft: GalleryNFT) => void;
		class?: string;
	}

	let { selectedNFT = null, onselect, class: className = '' }: Props = $props();

	let nfts = $derived(galleryStore.filteredAndSortedNFTs);
	let isLoading = $derived(galleryStore.isLoading);
	let error = $derived(galleryStore.error);

	// Image URL cache for performance
	const imageUrlCache = new Map<string, string>();

	function getImageUrl(nft: GalleryNFT): string {
		if (imageUrlCache.has(nft.id)) {
			return imageUrlCache.get(nft.id)!;
		}

		const url = URL.createObjectURL(new Blob([nft.imageData], { type: 'image/png' }));
		imageUrlCache.set(nft.id, url);
		return url;
	}

	function handleNFTClick(nft: GalleryNFT) {
		onselect?.(nft);
	}

	function getRarityColor(rank: number, total: number): string {
		const percentage = (rank / total) * 100;
		if (percentage <= 5) return 'bg-red-500 text-white';
		if (percentage <= 10) return 'bg-orange-500 text-white';
		if (percentage <= 25) return 'bg-yellow-500 text-black';
		if (percentage <= 50) return 'bg-green-500 text-white';
		return 'bg-blue-500 text-white';
	}

	onMount(() => {
		// Load gallery data if not already loaded
		if (galleryStore.collections.length === 0 && !isLoading) {
			galleryStore.loadFromIndexedDB();
		}
	});

	// Cleanup image URLs on component destroy
	$effect(() => {
		return () => {
			imageUrlCache.forEach((url) => URL.revokeObjectURL(url));
			imageUrlCache.clear();
		};
	});
</script>

<div class="space-y-4 {className}">
	<!-- Loading State -->
	{#if isLoading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
			{#each Array(6) as _}
				<div class="space-y-3">
					<Skeleton class="aspect-square w-full" />
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
			<svg class="text-muted-foreground mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
		<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1"/>
		<circle cx="8.5" cy="8.5" r="1.5" stroke-width="1"/>
		<polyline points="21 15 16 10 5 21" stroke-width="1"/>
	</svg>
			<div class="text-muted-foreground mb-2 text-lg">No NFTs in gallery</div>
			<div class="text-muted-foreground text-sm">Generate some NFTs first to see them here</div>
		</div>
	{:else}
		<!-- Gallery Grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
			{#each nfts as nft (nft.id)}
				<Card
					class="cursor-pointer transition-all hover:scale-105 hover:shadow-lg {selectedNFT?.id ===
					nft.id
						? 'ring-primary ring-2 ring-offset-2'
						: ''}"
					onclick={() => handleNFTClick(nft)}
				>
					<div class="relative">
						<!-- NFT Image -->
						<div class="bg-muted aspect-square overflow-hidden rounded-t-lg">
							<img
								src={getImageUrl(nft)}
								alt={nft.name}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>

						<!-- Rarity Badge -->
						<div class="absolute top-2 right-2">
							<Badge
								variant="secondary"
								class="{getRarityColor(nft.rarityRank, nfts.length)} text-xs font-semibold"
							>
								#{nft.rarityRank}
							</Badge>
						</div>
					</div>

					<!-- NFT Info -->
					<div class="p-3">
						<h3 class="text-foreground truncate text-sm font-semibold">
							{nft.name}
						</h3>
						<div class="text-muted-foreground mt-1 text-xs">
							{#if nft.metadata.traits.length > 0}
								{Array.from(new Set(nft.metadata.traits.map((t) => t.layer))).join(', ')}
							{:else}
								No traits
							{/if}
						</div>
						<div class="text-muted-foreground mt-2 text-xs">
							Rarity Score: {nft.rarityScore.toFixed(2)}
						</div>
					</div>
				</Card>
			{/each}
		</div>

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
