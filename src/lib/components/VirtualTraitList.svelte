<script lang="ts">
	import type { Trait } from '$lib/types/layer';
	import TraitCard from '$lib/components/TraitCard.svelte';
	import { onMount, onDestroy } from 'svelte';

	// interface Props {
	// 	traits?: Trait[];
	// 	layerId: string;
	// 	searchTerm?: string;
	// // }

	const {
		traits = [],
		layerId,
		searchTerm = '',
		selectedTraits = new Set(),
		onToggleSelection = (traitId: string) => {},
		showSelection = false
	} = $props();

	// Virtual scrolling parameters
	const ITEM_HEIGHT = 200; // Approximate height of each trait card in pixels
	const BUFFER_SIZE = 5; // Number of items to render outside the visible area
	const CONTAINER_HEIGHT = 384; // Fixed container height for better performance

	let container: HTMLElement;
	let visibleTraits = $state<Trait[]>([]);
	let offsetY = $state(0);
	let totalHeight = $state(0);
	let scrollTop = $state(0);
	let containerHeight = $state(CONTAINER_HEIGHT);

	// Filter traits based on search term
	$effect(() => {
		// This will recompute when traits or searchTerm changes
		updateVisibleTraits();
	});

	// Update visible traits based on scroll position with performance optimizations
	function updateVisibleTraits() {
		// First filter by search term if provided (cached computation)
		const filteredTraits = searchTerm
			? traits.filter((trait: Trait) => trait.name.toLowerCase().includes(searchTerm.toLowerCase()))
			: traits;

		// Update total height
		totalHeight = filteredTraits.length * ITEM_HEIGHT;

		// Calculate visible range with optimized math
		const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
		const endIndex = Math.min(
			filteredTraits.length,
			Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
		);

		// Use slice for better performance than manual iteration
		visibleTraits = filteredTraits.slice(startIndex, endIndex);
		offsetY = startIndex * ITEM_HEIGHT;
	}

	function handleScroll(e: Event) {
		const target = e.target as HTMLElement;
		scrollTop = target.scrollTop;
		updateVisibleTraits();
	}

	function updateContainerHeight() {
		if (container) {
			// Use fixed height for better performance and consistent virtualization
			containerHeight = CONTAINER_HEIGHT;
			updateVisibleTraits();
		}
	}

	onMount(() => {
		if (container) {
			container.addEventListener('scroll', handleScroll);
			// Set initial container height
			// Use a small delay to ensure the container is fully rendered
			setTimeout(() => {
				updateContainerHeight();
			}, 0);

			// Also update on resize
			window.addEventListener('resize', updateContainerHeight);
		}
	});

	onDestroy(() => {
		if (container) {
			container.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', updateContainerHeight);
		}
	});
</script>

<div class="relative h-full overflow-auto" bind:this={container}>
	<div style="height: {totalHeight}px;">
		<div
			class="absolute top-0 left-0 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
			style="transform: translateY({offsetY}px);"
		>
			{#each visibleTraits as trait (trait.id)}
				<TraitCard
					{trait}
					{layerId}
					selected={selectedTraits.has(trait.id)}
					onToggleSelection={() => onToggleSelection(trait.id)}
					{showSelection}
				/>
			{/each}
		</div>
	</div>
</div>
