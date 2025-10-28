<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import type { GalleryNFT } from '$lib/types/gallery';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Card from '$lib/components/ui/card/card.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	// Get source NFTs for trait extraction (avoid filtering overhead)
	const sourceNFTs = $derived(() => {
		if (galleryStore.selectedCollection) {
			return galleryStore.selectedCollection.nfts;
		} else {
			return galleryStore.collections.flatMap((collection) => collection.nfts);
		}
	});

	// Derive available traits from source NFTs (more efficient)
	const availableTraits = $derived(() => {
		const nfts = sourceNFTs();
		const traitMap = new Map<string, Set<string>>();

		for (const nft of nfts) {
			for (const trait of nft.metadata.traits) {
				const layer = trait.layer || (trait as any).trait_type;
				const traitValue = trait.trait || (trait as any).value;

				if (!layer || !traitValue) continue;

				if (!traitMap.has(layer)) {
					traitMap.set(layer, new Set());
				}
				traitMap.get(layer)!.add(traitValue);
			}
		}

		return Array.from(traitMap.entries()).map(([layer, traits]) => ({
			layer,
			traits: Array.from(traits).sort()
		}));
	});

	// Selected traits state
	let selectedTraits = $state<Record<string, string[]>>({});

	// Initialize from store
	$effect(() => {
		selectedTraits = { ...(galleryStore.filterOptions.selectedTraits || {}) };
	});

	function toggleTrait(layer: string, trait: string) {
		if (!selectedTraits[layer]) {
			selectedTraits[layer] = [];
		}

		const index = selectedTraits[layer].indexOf(trait);
		if (index === -1) {
			selectedTraits[layer].push(trait);
		} else {
			selectedTraits[layer].splice(index, 1);
			if (selectedTraits[layer].length === 0) {
				delete selectedTraits[layer];
			}
		}

		// Update store filters
		galleryStore.setFilterOptions({
			selectedTraits: Object.keys(selectedTraits).length > 0 ? selectedTraits : undefined
		});
	}

	function clearAllTraits() {
		selectedTraits = {};
		galleryStore.setFilterOptions({ selectedTraits: undefined });
	}

	function isTraitSelected(layer: string, trait: string): boolean {
		return selectedTraits[layer]?.includes(trait) || false;
	}

	function getTraitCount(layer: string, trait: string): number {
		// Use source NFTs for trait counts (more efficient)
		const nfts = sourceNFTs();
		return nfts.filter((nft) =>
			nft.metadata.traits.some((t) => {
				const tLayer = t.layer || (t as any).trait_type;
				const tValue = t.trait || (t as any).value;
				return tLayer === layer && tValue === trait;
			})
		).length;
	}
</script>

<Card class="p-4 {className}">
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-foreground font-semibold">Filter by Traits</h3>
			{#if Object.keys(selectedTraits).length > 0}
				<Button variant="ghost" size="sm" onclick={clearAllTraits}>Clear All</Button>
			{/if}
		</div>

		{#if availableTraits.length === 0}
			<div class="text-muted-foreground text-sm">
				No traits available. Generate some NFTs first.
			</div>
		{:else}
			<div class="space-y-3">
				{#each availableTraits() as traitGroup}
					<div class="space-y-2">
						<h4 class="text-foreground text-sm font-medium">{traitGroup.layer}</h4>
						<div class="flex flex-wrap gap-1">
							{#each traitGroup.traits as trait}
								{@const count = getTraitCount(traitGroup.layer, trait)}
								{@const isSelected = isTraitSelected(traitGroup.layer, trait)}
								<button
									type="button"
									class="cursor-pointer appearance-none border-none bg-transparent p-0"
									onclick={() => toggleTrait(traitGroup.layer, trait)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleTrait(traitGroup.layer, trait);
										}
									}}
								>
									<Badge
										variant={isSelected ? 'default' : 'outline'}
										class="hover:bg-primary/80 text-xs transition-colors"
									>
										{trait} ({count})
									</Badge>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Active filters summary -->
			{#if Object.keys(selectedTraits).length > 0}
				<div class="border-t pt-3">
					<div class="text-muted-foreground mb-2 text-sm">Active Filters:</div>
					<div class="flex flex-wrap gap-1">
						{#each Object.entries(selectedTraits) as [layer, traits]}
							{#each traits as trait}
								<Badge variant="secondary" class="text-xs">
									{layer}: {trait}
								</Badge>
							{/each}
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</Card>
