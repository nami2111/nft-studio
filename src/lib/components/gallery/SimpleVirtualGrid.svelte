<script lang="ts">
	import type { GalleryItem } from '$lib/types/gallery';
	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { onMount, untrack } from 'svelte';
	import Icon from '$components/shared/Icon.svelte';
	import { AlertCircleIcon, RefreshIcon } from '@hugeicons/core-free-icons';

	interface Props {
		items: GalleryItem[];
		selectedItem?: GalleryItem | null;
		onselect?: (item: GalleryItem) => void;
		class?: string;
		columns?: number;
		itemHeight?: number;
		gap?: number;
	}

	const {
		items,
		selectedItem = null,
		onselect,
		class: className = '',
		columns = 4,
		itemHeight = 200,
		gap = 12
	}: Props = $props();

	// Virtual scrolling state
	let scrollElement: HTMLDivElement | null = $state(null);
	let containerHeight = $state(0);
	let scrollTop = $state(0);

	// Calculate visible range
	let visibleStart = $state(0);
	let visibleEnd = $state(0);
	const overscanRows = 3;

	// Calculate grid dimensions
	const rowHeight = $derived(itemHeight + gap);

	// Update visible range
	function calculateVisibleRange() {
		// Use local variable to ensure we have a stable reference during calculation
		const currentItems = items;
		const currentHeight = containerHeight;

		if (!currentItems || currentItems.length === 0 || currentHeight <= 0) {
			// If height is 0, we still want to render something initially if possible
			if (currentItems && currentItems.length > 0 && currentHeight === 0) {
				visibleStart = 0;
				visibleEnd = Math.min(currentItems.length, columns * 10); // Render first 10 rows as safety
			}
			return;
		}

		// Calculate which rows are visible
		const startRow = Math.floor(scrollTop / rowHeight);
		const rowsVisible = Math.ceil(currentHeight / rowHeight);
		const endRow = Math.min(Math.ceil(currentItems.length / columns), startRow + rowsVisible);

		// Apply overscan to rows, then convert to item indices
		const overscanStartRow = Math.max(0, startRow - overscanRows);
		const overscanEndRow = Math.min(Math.ceil(currentItems.length / columns), endRow + overscanRows);

		// Convert row indices to item indices
		visibleStart = overscanStartRow * columns;
		visibleEnd = Math.min(currentItems.length, overscanEndRow * columns);

		// Clean up imageUrls for items scrolled far past the keep window
		const cleanBuffer = overscanRows * 3;
		const keepStart = Math.max(0, overscanStartRow - cleanBuffer) * columns;
		const keepEnd = Math.min(currentItems.length, (overscanEndRow + cleanBuffer) * columns);

		const keepIds = new Set<string>();
		for (let i = keepStart; i < keepEnd; i++) {
			const it = currentItems[i];
			if (it) keepIds.add(it.id);
		}

		for (const id of Object.keys(imageUrls)) {
			if (!keepIds.has(id)) delete imageUrls[id];
		}
	}

	// Update visible range when scrolling
	function handleScroll() {
		if (!scrollElement) return;

		scrollTop = scrollElement.scrollTop;

		// Clear any pending timeout
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}

		// Update immediately for better responsiveness, but keep the timeout for final sync
		calculateVisibleRange();

		scrollTimeout = setTimeout(() => {
			calculateVisibleRange();
		}, 16);
	}

	// Debounce scroll calculations
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

	// LAZY image URL creation - only create when actually needed
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const imageLoadQueue = new Set<string>(); // Use native Set for internal queue, doesn't need to be reactive
	let imageUrls = $state<Record<string, string>>({});

	// Request image URL creation (async, non-blocking)
	// Falls back to IndexedDB when imageData is not in memory.
	// DOES NOT cache error state for IndexedDB misses — images may be
	// streaming in during import, so the next render will retry naturally.
	function requestImageUrl(item: GalleryItem): string {
		// Check if already loaded
		if (imageUrls[item.id]) {
			return imageUrls[item.id];
		}

		// Check if imageData exists in memory
		const hasImageData =
			item.imageData &&
			(typeof item.imageData === 'string' || item.imageData.byteLength > 0);

		if (!hasImageData && imageUrls[item.id] === undefined) {
			// No data in memory — fetch from IndexedDB on demand
			if (!imageLoadQueue.has(item.id)) {
				imageLoadQueue.add(item.id);

				setTimeout(async () => {
					try {
						const buffer = await galleryStore.getItemImage(item.id);
						if (buffer && buffer.byteLength > 0) {
							const url = imageUrlCache.get(item.id, buffer);
							if (url) {
								imageUrls[item.id] = url;
							} else {
								// decode failure on valid buffer
								imageUrls[item.id] = 'error';
							}
						}
						// If buffer is null/empty: image not streamed yet.
						// Don't set error — the next render will retry.
						imageLoadQueue.delete(item.id);
					} catch {
						imageLoadQueue.delete(item.id);
						imageUrls[item.id] = 'error';
					}
				}, 0);

				// Timeout protection (30 seconds for streaming import window)
				setTimeout(() => {
					if (imageLoadQueue.has(item.id)) {
						imageLoadQueue.delete(item.id);
						// Don't set error — image may still be streaming in,
						// next scroll/render will retry the IndexedDB fetch.
					}
				}, 30000);
			}
			return '';
		}

		// Check if imageData exists (in-memory path)
		if (!item.imageData || (typeof item.imageData !== 'string' && item.imageData.byteLength === 0)) {
			return '';
		}

		// Add to queue for async loading (in-memory path)
		if (!imageLoadQueue.has(item.id)) {
			imageLoadQueue.add(item.id);

			setTimeout(() => {
				try {
					const url = imageUrlCache.get(item.id, item.imageData);
					imageUrls[item.id] = url;
					imageLoadQueue.delete(item.id);
				} catch {
					imageLoadQueue.delete(item.id);
					imageUrls[item.id] = 'error';
				}
			}, 0);

			// Timeout protection (5 seconds max for in-memory decode)
			setTimeout(() => {
				if (imageLoadQueue.has(item.id)) {
					imageLoadQueue.delete(item.id);
					imageUrls[item.id] = 'error';
				}
			}, 5000);
		}

		// Return placeholder while loading
		return '';
	}

	// Handle image loading errors with automatic retry
	function handleImageError(event: Event, item: GalleryItem) {
		const target = event.target as HTMLImageElement;

		// Try to handle the error using the cache
		const retryUrl = imageUrlCache.handleUrlError(item.id);
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

	function handleItemClick(item: GalleryItem) {
		onselect?.(item);
	}

	// ResizeObserver to properly track container height changes
	let resizeObserver: ResizeObserver | null = null;
	let hasInitialized = false;
	let wrapperElement: HTMLDivElement | undefined = $state();

	onMount(() => {
		// Set up ResizeObserver on the wrapper element to track its height
		if (wrapperElement) {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const newHeight = entry.contentRect.height;
					if (newHeight > 0) {
						containerHeight = newHeight;
						if (!hasInitialized) {
							hasInitialized = true;
						}
					}
				}
			});
			resizeObserver.observe(wrapperElement);

			// Also try to get initial height immediately
			const initialHeight = wrapperElement.clientHeight;
			if (initialHeight > 0) {
				containerHeight = initialHeight;
				hasInitialized = true;
			}
		}

		// Calculate initial visible range after DOM is ready
		requestAnimationFrame(() => {
			calculateVisibleRange();
		});

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});

	// Recalculate when items or container height change
	$effect(() => {
		// Track dependencies
		const _items = items;
		const _height = containerHeight;

		untrack(() => {
			calculateVisibleRange();
		});
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
	const totalHeight = $derived(Math.ceil(items.length / columns) * rowHeight);
</script>

<div bind:this={wrapperElement} class="flex flex-1 flex-col {className}">
	<!-- Debug info - strictly flex-none to push content down -->
	{#if import.meta.env.DEV}
		<div
			class="border-border/40 text-muted-foreground bg-muted/30 flex-none border-b px-2 py-1 font-mono text-[10px] backdrop-blur-sm"
		>
			Total: {items.length} | Showing: {visibleEnd - visibleStart} (indexes {visibleStart}-{visibleEnd})
			| Container: {containerHeight.toFixed(0)}px
		</div>
	{/if}

	<!-- This container creates the "box" for the absolute scroll area -->
	<div class="relative min-h-0 flex-1">
		<div
			bind:this={scrollElement}
			bind:clientHeight={containerHeight}
			class="absolute inset-0 overflow-y-auto"
			onscroll={handleScroll}
		>
			<!-- Spacer for total height - add top padding via transform -->
			<div style="height: {totalHeight + 40}px; position: relative; padding-top: 20px;">
				<!-- Visible items -->
				{#each Array.from({ length: visibleEnd - visibleStart }, (_, i) => visibleStart + i) as itemIndex (itemIndex)}
					{@const item = items[itemIndex]}
					{@const row = Math.floor(itemIndex / columns)}
					{@const col = itemIndex % columns}
					{#if item}
						<button
							type="button"
							class="group bg-muted/50 hover:border-primary absolute cursor-pointer overflow-hidden border transition-all hover:scale-105 {selectedItem?.id ===
							item.id
								? 'ring-primary ring-2'
								: ''}"
							style="top: {row * rowHeight + 20}px; left: calc({(col * 100) / columns}% + {(col *
								gap) /
								columns}px); width: calc({100 / columns}% - {(gap * (columns - 1)) /
								columns}px); height: {itemHeight}px;"
							onclick={() => handleItemClick(item)}
						>
							<!-- Item Image -->
							<div class="bg-muted h-full w-full overflow-hidden">
								{#if true}
									{@const imageUrl = requestImageUrl(item)}
								{#if imageUrl && imageUrl !== 'error'}
									<img
										src={imageUrl}
										alt={item.name}
										class="h-full w-full object-cover transition-transform group-hover:scale-110"
										loading="lazy"
										onerror={(e) => handleImageError(e, item)}
									/>
									<div
										class="bg-muted text-muted-foreground h-full w-full items-center justify-center p-2 text-xs"
										style="display: none;"
									>
										<div class="text-center">
											<Icon icon={AlertCircleIcon} class="mx-auto mb-1 h-6 w-6" />
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
											<Icon icon={AlertCircleIcon} class="mx-auto mb-1 h-6 w-6" />
											<div>Load Error</div>
											<div class="mt-1 text-xs opacity-70">Timeout</div>
										</div>
									</div>
								{:else}
									<!-- Show loading state when image is being fetched -->
									<div
										class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center p-2 text-xs"
									>
										<div class="text-center">
											<Icon icon={RefreshIcon} class="mx-auto mb-1 h-6 w-6 animate-spin" />
											<div>Loading...</div>
										</div>
									</div>
								{/if}
								{/if}
							</div>

							<!-- Rarity Badge -->
							<div class="absolute top-1 right-1">
								<span class="rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
									#{item.rarityRank}
								</span>
							</div>

							<!-- Hover overlay -->
							<div
								class="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
							>
								<div class="absolute right-0 bottom-0 left-0 p-1 text-white">
									<div class="truncate text-[10px] font-medium">{item.name}</div>
									<div class="text-[9px] opacity-80">Score: {item.rarityScore.toFixed(1)}</div>
								</div>
							</div>
						</button>
					{/if}
				{/each}
			</div>
		</div>
	</div>
</div>
