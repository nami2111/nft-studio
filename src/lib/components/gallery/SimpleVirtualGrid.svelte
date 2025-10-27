<script lang="ts">
	import type { GalleryNFT } from '$lib/types/gallery';
	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import { onMount } from 'svelte';

	interface Props {
		nfts: GalleryNFT[];
		selectedNFT?: GalleryNFT | null;
		onselect?: (nft: GalleryNFT) => void;
		class?: string;
		columns?: number;
		itemHeight?: number;
		gap?: number;
	}

	let {
		nfts,
		selectedNFT = null,
		onselect,
		class: className = '',
		columns = 4,
		itemHeight = 200,
		gap = 12
	}: Props = $props();

	// Virtual scrolling state
	let scrollElement: HTMLDivElement;
	let containerHeight = $state(600);
	let scrollTop = $state(0);

	// Calculate visible range
	let visibleStart = $state(0);
	let visibleEnd = $state(0);
	const overscanRows = 3; // Render extra rows outside viewport

	// Update visible range
	function calculateVisibleRange() {
		if (!scrollElement || !nfts || nfts.length === 0) return;

		const rect = scrollElement.getBoundingClientRect();
		containerHeight = rect.height || 600;

		const rowHeight = itemHeight + gap;

		// Calculate which rows are visible
		const startRow = Math.floor(scrollTop / rowHeight);
		const rowsVisible = Math.ceil(containerHeight / rowHeight);
		const endRow = Math.min(Math.ceil(nfts.length / columns), startRow + rowsVisible);

		// Apply overscan to rows, then convert to item indices
		const overscanStartRow = Math.max(0, startRow - overscanRows);
		const overscanEndRow = Math.min(Math.ceil(nfts.length / columns), endRow + overscanRows);

		// Convert row indices to item indices (multiply by columns)
		visibleStart = overscanStartRow * columns;
		visibleEnd = Math.min(nfts.length, overscanEndRow * columns);
	}

	// Update visible range when scrolling
	function handleScroll() {
		if (!scrollElement) return;

		scrollTop = scrollElement.scrollTop;
		calculateVisibleRange();
	}

	// Get image URL with caching
	function getImageUrl(nft: GalleryNFT): string {
		return imageUrlCache.get(nft.id, nft.imageData);
	}

	function handleNFTClick(nft: GalleryNFT) {
		onselect?.(nft);
	}

	// Preload images as they come into view
	$effect(() => {
		if (!nfts || nfts.length === 0) return;

		// Preload images in the visible range with some buffer
		const preloadStart = Math.max(0, visibleStart - 20);
		const preloadEnd = Math.min(nfts.length, visibleEnd + 30);

		for (let i = preloadStart; i < preloadEnd; i++) {
			const nft = nfts[i];
			if (nft) {
				const stats = imageUrlCache.getStats();
				// Only preload if cache is not at capacity
				if (stats.size < stats.maxSize * 0.9) {
					imageUrlCache.preload(nft.id, nft.imageData);
				}
			}
		}
	});

	onMount(() => {
		// Calculate initial visible range after DOM is ready
		setTimeout(() => {
			calculateVisibleRange();
		}, 0);
	});

	// Recalculate when nfts change
	$effect(() => {
		if (nfts && nfts.length > 0) {
			setTimeout(() => {
				calculateVisibleRange();
			}, 0);
		}
	});

	// Calculate total height
	const totalHeight = $derived(
		Math.ceil(nfts.length / columns) * (itemHeight + gap)
	);
</script>

<div class={className}>
	<!-- Debug info -->
	{#if import.meta.env.DEV}
		<div class="mb-2 text-xs text-muted-foreground">
			Total: {nfts.length} | Showing: {visibleEnd - visibleStart} (indexes {visibleStart}-{visibleEnd}) | Container: {containerHeight.toFixed(0)}px
		</div>
	{/if}

	<div
		bind:this={scrollElement}
		class="relative overflow-y-auto"
		onscroll={handleScroll}
	>
		<!-- Spacer for total height -->
		<div style="height: {totalHeight}px; position: relative;">
			<!-- Visible items -->
			{#each Array.from({ length: visibleEnd - visibleStart }, (_, i) => visibleStart + i) as nftIndex (nftIndex)}
				{@const nft = nfts[nftIndex]}
				{@const row = Math.floor(nftIndex / columns)}
				{@const col = nftIndex % columns}
				{#if nft}
					<button
						type="button"
						class="group absolute bg-muted/50 hover:border-primary cursor-pointer overflow-hidden border transition-all hover:scale-105 {selectedNFT?.id ===
						nft.id
							? 'ring-primary ring-2'
							: ''}"
						style="top: {row * (itemHeight + gap)}px; left: {col * (100 / columns)}%; width: calc({100 / columns}% - {gap * (columns - 1) / columns}px); height: {itemHeight}px; {col > 0 ? `margin-left: ${gap}px;` : ''}"
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
						<div class="absolute top-1 right-1">
							<span class="text-[10px] font-semibold px-1 py-0.5 rounded bg-black/70 text-white">
								#{nft.rarityRank}
							</span>
						</div>

						<!-- Hover overlay -->
						<div
							class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
						>
							<div class="absolute right-0 bottom-0 left-0 p-1 text-white">
								<div class="truncate text-[10px] font-medium">{nft.name}</div>
								<div class="text-[9px] opacity-80">Score: {nft.rarityScore.toFixed(1)}</div>
							</div>
						</div>
					</button>
				{/if}
			{/each}
		</div>
	</div>
</div>
