<script lang="ts">
	import type { GalleryCollection } from '$lib/types/gallery';

	interface Props {
		collection: GalleryCollection;
		class?: string;
	}

	const { collection, class: className = '' }: Props = $props();

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

{#snippet statCell(label: string, value: string | number)}
	<div class="space-y-1">
		<div class="text-muted-foreground text-xs">{label}</div>
		<div class="text-lg font-bold tabular-nums">{value}</div>
	</div>
{/snippet}

<div class="p-4 {className}">
	<h3 class="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
		Collection Stats
	</h3>
	<div class="grid grid-cols-2 gap-4">
		{@render statCell('Total Items', collection.totalSupply)}
		{@render statCell('Rarest Rank', '#' + rarestRank)}
		{@render statCell('Avg Rarity Score', avgScore.toFixed(2))}
		{@render statCell(
			'Generated On',
			new Date(collection.generatedAt).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			})
		)}
	</div>
</div>
