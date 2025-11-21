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
	let containerHeight = $state(700); // Fixed height for better performance
	let scrollTop = $state(0);

	// Calculate visible range
	let visibleStart = $state(0);
	let visibleEnd = $state(0);
	const overscanRows = 3; // Render extra rows outside viewport

	// Calculate grid dimensions
	const rowHeight = $derived(itemHeight + gap);

	// Update visible range with performance tracking
	function calculateVisibleRange() {
		// Debug logging disabled to prevent console spam in gallery mode
		const start = performance.now();
		const endTiming = () => {
			const end = performance.now();
			// Grid calculations are now fast enough that debug logging causes spam
			// Only uncomment for debugging specific performance issues
			// if (end - start > 500) {
			// 	debugLog(`⏱️ Grid Range: ${(end - start).toFixed(2)}ms`);
			// }
		};

		if (!scrollElement || !nfts || nfts.length === 0) {
			endTiming();
			return;
		}

		// Use fixed height for consistent performance
		const rect = scrollElement.getBoundingClientRect();
		// Only update if rect height is very different from our fixed height
		if (Math.abs(rect.height - containerHeight) > 100) {
			containerHeight = Math.max(600, rect.height);
		}

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

		endTiming();
	}

	// Update visible range when scrolling (debounced for performance)
	function handleScroll() {
		if (!scrollElement) return;

		scrollTop = scrollElement.scrollTop;

		// Clear any pending timeout
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}

		// Debounce the calculation to prevent excessive calls during rapid scrolling
		scrollTimeout = setTimeout(() => {
			if (nfts && nfts.length > 0) {
				calculateVisibleRange();
			}
		}, 16); // ~60fps
	}

	// Debounce cache to prevent rapid URL creation
	const urlCache = new Map<string, string>();
	let lastCacheClear = 0;

	// Debounce scroll calculations
	let scrollTimeout: number | null = null;

	// LAZY image URL creation - only create when actually needed
	let imageLoadQueue = new Set<string>();
	let imageUrls = $state<Record<string, string>>({});

	// Request image URL creation (async, non-blocking)
	function requestImageUrl(nft: GalleryNFT): string {
		// Check if already loaded
		if (imageUrls[nft.id]) {
			return imageUrls[nft.id];
		}

		// Check if imageData exists
		if (!nft.imageData || nft.imageData.byteLength === 0) {
			return '';
		}

		// Add to queue for async loading
		if (!imageLoadQueue.has(nft.id)) {
			imageLoadQueue.add(nft.id);

			// Load image in background without blocking UI
			const loadTimeout = setTimeout(() => {
				const startUrl = performance.now();
				try {
					const url = imageUrlCache.get(nft.id, nft.imageData);
					imageUrls[nft.id] = url; // This triggers reactivity!
					imageLoadQueue.delete(nft.id);

					// Logging disabled to prevent console spam - can be re-enabled for debugging
					const endUrl = performance.now();
					// if (endUrl - startUrl > 500) {
					// 	debugLog(`🖼️ Slow: ${nft.id} (${(endUrl - startUrl).toFixed(2)}ms)`);
					// }
				} catch (error) {
					// Error logging disabled to prevent console spam - can be re-enabled for debugging
					// debugLog(`🖼️ ❌ Failed: ${nft.id}`);
					imageLoadQueue.delete(nft.id);
					imageUrls[nft.id] = 'error';
				}
			}, 0);

			// Add timeout protection (5 seconds max)
			setTimeout(() => {
				if (imageLoadQueue.has(nft.id)) {
					imageLoadQueue.delete(nft.id);
					// Mark as failed to prevent infinite loading
					imageUrls[nft.id] = 'error';
				}
			}, 5000);
		}

		// Return placeholder while loading
		return '';
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

	// Minimal preloading to avoid overwhelming the cache - DISABLED FOR PERFORMANCE
	$effect(() => {
		// Skip preloading to avoid the 44-216ms URL creation bottleneck
		// Images will be loaded on-demand when they come into view
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

	// Cleanup timeout on unmount
	$effect(() => {
		return () => {
			if (scrollTimeout) {
				clearTimeout(scrollTimeout);
			}
		};
	});

	// Calculate total height
	const totalHeight = $derived(Math.ceil(nfts.length / columns) * rowHeight);
</script>

<div class={className}>
	<!-- Debug info -->
	{#if import.meta.env.DEV}
		<div class="text-muted-foreground mb-2 text-xs">
			Total: {nfts.length} | Showing: {visibleEnd - visibleStart} (indexes {visibleStart}-{visibleEnd})
			| Container: {containerHeight.toFixed(0)}px
		</div>
	{/if}

	<div
		bind:this={scrollElement}
		class="relative overflow-y-auto"
		style="height: calc(100vh - 320px); min-height: 800px;"
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
						class="group bg-muted/50 hover:border-primary absolute cursor-pointer overflow-hidden border transition-all hover:scale-105 {selectedNFT?.id ===
						nft.id
							? 'ring-primary ring-2'
							: ''}"
						style="top: {row * rowHeight}px; left: {col * (100 / columns)}%; width: calc({100 /
							columns}% - {(gap * (columns - 1)) / columns}px); height: {itemHeight}px; {col > 0
							? `margin-left: ${gap}px;`
							: ''}"
						onclick={() => handleNFTClick(nft)}
					>
						<!-- NFT Image -->
						<div class="bg-muted h-full w-full overflow-hidden">
							{#if nft.imageData && nft.imageData.byteLength > 0}
								{@const imageUrl = requestImageUrl(nft)}
								{#if imageUrl && imageUrl !== 'error'}
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
											<svg
												class="mx-auto mb-1 h-6 w-6"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													stroke-width="1"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
											<div>Image Unavailable</div>
											<div class="mt-1 text-xs opacity-70">Loading failed</div>
										</div>
									</div>
								{:else if imageUrl === 'error'}
									<!-- Show error state -->
									<div
										class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center p-2 text-xs"
									>
										<div class="text-center">
											<svg
												class="mx-auto mb-1 h-6 w-6"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													stroke-width="1"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
											<div>Load Error</div>
											<div class="mt-1 text-xs opacity-70">Timeout</div>
										</div>
									</div>
								{:else}
									<!-- Show loading state when no URL is available -->
									<div
										class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center p-2 text-xs"
									>
										<div class="text-center">
											<svg
												class="mx-auto mb-1 h-6 w-6 animate-spin"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
													stroke-width="1"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
											<div>Loading...</div>
										</div>
									</div>
								{/if}
							{:else}
								<!-- Show placeholder/error state when no image is available -->
								<div
									class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center p-2 text-xs"
								>
									<div class="text-center">
										<svg
											class="mx-auto mb-1 h-6 w-6"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
										<div>No Image</div>
									</div>
								</div>
							{/if}
						</div>

						<!-- Rarity Badge -->
						<div class="absolute top-1 right-1">
							<span class="rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
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
