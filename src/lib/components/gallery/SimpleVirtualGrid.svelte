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

	// Calculate grid dimensions
	const rowHeight = $derived(itemHeight + gap);

	// Update visible range
	function calculateVisibleRange() {
		if (!scrollElement || !nfts || nfts.length === 0) return;

		const rect = scrollElement.getBoundingClientRect();
		containerHeight = rect.height || 600;

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

	// Debounce cache to prevent rapid URL creation
	const urlCache = new Map<string, string>();
	let lastCacheClear = 0;

	// Get image URL with caching and error handling
	function getImageUrl(nft: GalleryNFT): string {
		// Check if imageData exists (might be missing if loaded from non-persisted state)
		if (!nft.imageData || nft.imageData.byteLength === 0) {
			return '';
		}

		// Check if we have a recent cached URL (within 1 second)
		const now = Date.now();
		const cached = urlCache.get(nft.id);
		if (cached && (now - lastCacheClear) < 1000) {
			return cached;
		}

		// Clear old cache entries periodically
		if (now - lastCacheClear > 1000) {
			urlCache.clear();
			lastCacheClear = now;
		}

		// Get fresh URL and cache it
		const url = imageUrlCache.get(nft.id, nft.imageData);
		urlCache.set(nft.id, url);
		return url;
	}

	// Handle image loading errors with automatic retry
	function handleImageError(event: Event, nft: GalleryNFT) {
		const target = event.target as HTMLImageElement;

		// Try to handle the error using the cache
		const retryUrl = imageUrlCache.handleUrlError(nft.id);
		if (retryUrl && retryUrl !== target.src) {
			// Retry with the new URL
			target.src = retryUrl;
			return;
		}

		// If retry failed or no retry available, hide image and show error state
		target.style.display = 'none';
		const nextElement = target.nextElementSibling as HTMLElement;
		if (nextElement) {
			nextElement.style.display = 'flex';
		}
	}

	function handleNFTClick(nft: GalleryNFT) {
		onselect?.(nft);
	}

	// Minimal preloading to avoid overwhelming the cache
	$effect(() => {
		if (!nfts || nfts.length === 0) return;

		// Only preload images in immediate visible range (no buffer for large collections)
		const preloadStart = visibleStart;
		const preloadEnd = Math.min(nfts.length, visibleEnd + 10);

		for (let i = preloadStart; i < preloadEnd; i++) {
			const nft = nfts[i];
			if (nft && nft.imageData) {
				const stats = imageUrlCache.getStats();
				// Be very conservative about preloading for large collections
				if (stats.size < stats.maxSize * 0.6) {
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
	const totalHeight = $derived(Math.ceil(nfts.length / columns) * rowHeight);
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
						style="top: {row * rowHeight}px; left: {col * (100 / columns)}%; width: calc({100 / columns}% - {gap * (columns - 1) / columns}px); height: {itemHeight}px; {col > 0 ? `margin-left: ${gap}px;` : ''}"
						onclick={() => handleNFTClick(nft)}
					>
						<!-- NFT Image -->
						<div class="bg-muted h-full w-full overflow-hidden">
							{#if nft.imageData && nft.imageData.byteLength > 0}
								{@const imageUrl = getImageUrl(nft)}
								{#if imageUrl}
									<img
										src={imageUrl}
										alt={nft.name}
										class="h-full w-full object-cover transition-transform group-hover:scale-110"
										loading="lazy"
										onerror={(e) => handleImageError(e, nft)}
									/>
									<div
										class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-2 text-xs"
										style="display: none;"
									>
										<div class="text-center">
											<svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
											<div>Image Unavailable</div>
											<div class="text-xs opacity-70 mt-1">Loading failed</div>
										</div>
									</div>
								{:else}
									<!-- Show loading state when no URL is available -->
									<div class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-2 text-xs flex">
										<div class="text-center">
											<svg class="mx-auto h-6 w-6 mb-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
											</svg>
											<div>Loading...</div>
										</div>
									</div>
								{/if}
							{:else}
								<!-- Show placeholder/error state when no image is available -->
								<div class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-2 text-xs flex">
									<div class="text-center">
										<svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
										<div>No Image</div>
									</div>
								</div>
							{/if}
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
