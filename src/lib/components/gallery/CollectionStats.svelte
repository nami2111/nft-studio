<script lang="ts">
	import type { GalleryCollection } from '$lib/types/gallery';

	interface Props {
		collection: GalleryCollection;
		class?: string;
	}

	let { collection, class: className = '' }: Props = $props();

	// Derived stats
	const rarestRank = $derived(
		collection.nfts.length > 0 ? Math.min(...collection.nfts.map((n) => n.rarityRank)) : 0
	);
	const avgScore = $derived(
		collection.nfts.length > 0
			? collection.nfts.reduce((sum, n) => sum + n.rarityScore, 0) / collection.nfts.length
			: 0
	);
</script>

<div class="p-4 {className}">
	<h3 class="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
		Collection Stats
	</h3>
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">Total NFTs</div>
			<div class="text-lg font-bold tabular-nums">{collection.totalSupply}</div>
		</div>
		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">Rarest Rank</div>
			<div class="text-lg font-bold tabular-nums">#{rarestRank}</div>
		</div>
		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">Avg Rarity Score</div>
			<div class="text-lg font-bold tabular-nums">{avgScore.toFixed(2)}</div>
		</div>
		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">Generated On</div>
			<div class="text-sm font-medium">
				{new Date(collection.generatedAt).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})}
			</div>
		</div>
	</div>
</div>
