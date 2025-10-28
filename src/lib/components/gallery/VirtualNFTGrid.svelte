<script lang="ts">
	import type { GalleryNFT } from '$lib/types/gallery';
	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import { onMount } from 'svelte';

	interface Props {
		nfts: GalleryNFT[];
		selectedNFT?: GalleryNFT | null;
		onselect?: (nft: GalleryNFT) => void;
		class?: string;
	}

	let { nfts, selectedNFT = null, onselect, class: className = '' }: Props = $props();

	// Virtual scrolling state
	let scrollElement: HTMLDivElement;
	let itemHeight = 250; // Height of each item including gap
	let containerHeight = 600; // Visible container height
	let scrollTop = 0;

	// Calculate visible range
	let visibleStart = $state(0);
	let visibleEnd = $state(0);
	const overscan = 10; // Render extra items outside viewport

	// Update visible range when scrolling
	function handleScroll() {
		if (!scrollElement) return;

		scrollTop = scrollElement.scrollTop;
		const start = Math.floor(scrollTop / itemHeight);
		const end = Math.min(nfts.length, Math.ceil((scrollTop + containerHeight) / itemHeight));

		visibleStart = Math.max(0, start - overscan);
		visibleEnd = Math.min(nfts.length, end + overscan);
	}

	// Get image URL with caching
	function getImageUrl(nft: GalleryNFT): string {
		return imageUrlCache.get(nft.id, nft.imageData);
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

	// Removed expensive preload effect for better performance

	onMount(() => {
		// Initial preload of first page of images
		const preloadCount = Math.min(50, nfts.length);
		for (let i = 0; i < preloadCount; i++) {
			if (nfts[i]) {
				imageUrlCache.preload(nfts[i].id, nfts[i].imageData);
			}
		}

		// Initial scroll calculation
		handleScroll();
	});

	// Calculate total height
	const totalHeight = $derived(nfts.length * itemHeight);
</script>

<div class={className}>
	<div
		bind:this={scrollElement}
		class="relative overflow-y-auto"
		style="height: {containerHeight}px;"
		onscroll={handleScroll}
	>
		<!-- Spacer for total height -->
		<div style="height: {totalHeight}px; position: relative;">
			<!-- Visible items -->
			{#each nfts.slice(visibleStart, visibleEnd) as nft, i (nft.id)}
				{@const actualIndex = visibleStart + i}
				<div
					class="absolute right-0 left-0 p-4"
					style="top: {actualIndex * itemHeight}px; height: {itemHeight}px;"
				>
					<button
						type="button"
						class="group bg-muted/50 hover:border-primary relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-lg border transition-all hover:scale-105 {selectedNFT?.id ===
						nft.id
							? 'ring-primary ring-2'
							: ''}"
						onclick={() => handleNFTClick(nft)}
					>
						<!-- NFT Image -->
						<div class="bg-muted h-full w-full overflow-hidden">
							<img
								src={getImageUrl(nft)}
								alt={nft.name}
								class="h-full w-full object-cover transition-transform group-hover:scale-110"
								loading="lazy"
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
						</div>

						<!-- Rarity Badge -->
						<div class="absolute top-2 right-2">
							<span
								class="rounded px-2 py-1 text-xs font-semibold {getRarityColor(
									nft.rarityRank,
									nfts.length
								)}"
							>
								#{nft.rarityRank}
							</span>
						</div>

						<!-- Hover overlay -->
						<div
							class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
						>
							<div class="absolute right-0 bottom-0 left-0 p-2 text-white">
								<div class="truncate text-sm font-medium">{nft.name}</div>
								<div class="text-xs opacity-80">Score: {nft.rarityScore.toFixed(1)}</div>
								{#if nft.metadata.traits?.length > 0}
									<div class="mt-1 text-xs opacity-75">
										{Array.from(
											new Set(nft.metadata.traits.map((t) => t.layer || (t as any).trait_type))
										).join(', ')}
									</div>
								{/if}
							</div>
						</div>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Debug stats for development -->
	{#if import.meta.env.DEV}
		<div class="fixed right-4 bottom-4 rounded bg-black/80 px-3 py-2 text-xs text-white">
			<div class="space-y-1">
				<div>Visible: {visibleStart}-{visibleEnd}/{nfts.length}</div>
				<div>Cached: {imageUrlCache.getStats().size}/{imageUrlCache.getStats().maxSize}</div>
				<div>Memory: {(imageUrlCache.getStats().memory / (1024 * 1024)).toFixed(1)}MB</div>
			</div>
		</div>
	{/if}
</div>
