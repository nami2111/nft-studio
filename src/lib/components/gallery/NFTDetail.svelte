<script lang="ts">
	import type { GalleryNFT } from '$lib/types/gallery';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { getMimeType } from '$lib/utils/image-format-detector';
	import { imageUrlCache } from '$lib/utils/object-url-cache';

	interface Props {
		selectedNFT?: GalleryNFT | null;
		class?: string;
		hideCard?: boolean;
		selectedTraits?: Record<string, string[]>;
		ontraitclick?: (layer: string, value: string) => void;
	}

	const {
		selectedNFT,
		class: className = '',
		hideCard = false,
		selectedTraits = {},
		ontraitclick
	}: Props = $props();

	const imageUrl = $derived(
		selectedNFT ? imageUrlCache.get(selectedNFT.id, selectedNFT.imageData) : null
	);

	function getRarityColor(rank: number, total: number): string {
		const percentage = (rank / total) * 100;
		if (percentage <= 5) return 'bg-red-500 text-white';
		if (percentage <= 10) return 'bg-orange-500 text-white';
		if (percentage <= 25) return 'bg-yellow-500 text-black';
		if (percentage <= 50) return 'bg-green-500 text-white';
		return 'bg-blue-500 text-white';
	}

	function formatRarityScore(score: number): string {
		return score.toFixed(2);
	}
</script>

{#snippet content()}
	{#if selectedNFT}
		<div class="space-y-6">
			<!-- NFT Image -->
			<div class="bg-muted/30 ring-border relative aspect-square overflow-hidden rounded-xl ring-1">
				{#if imageUrl}
					<img
						src={imageUrl}
						alt={selectedNFT.name}
						class="h-full w-full object-contain transition-transform hover:scale-105"
					/>
				{:else}
					<div class="bg-muted h-full w-full animate-pulse"></div>
				{/if}
			</div>

			<!-- NFT Name and Rarity -->
			<div>
				<div class="flex items-start justify-between gap-4">
					<h2 class="text-foreground text-xl font-bold tracking-tight">
						{selectedNFT.name}
					</h2>
					<Badge
						variant="secondary"
						class="{getRarityColor(
							selectedNFT.rarityRank,
							100
						)} shrink-0 text-xs font-bold uppercase transition-colors"
					>
						Rank #{selectedNFT.rarityRank}
					</Badge>
				</div>
				{#if selectedNFT.description}
					<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
						{selectedNFT.description}
					</p>
				{/if}
			</div>

			<!-- Rarity Information -->
			<div class="space-y-3">
				<h3 class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
					Rarity Details
				</h3>
				<div class="grid grid-cols-2 gap-3">
					<div class="bg-muted/30 ring-border rounded-lg p-3 ring-1">
						<div class="text-muted-foreground text-[10px] uppercase">Score</div>
						<div class="text-lg font-bold tabular-nums">
							{formatRarityScore(selectedNFT.rarityScore)}
						</div>
					</div>
					<div class="bg-muted/30 ring-border rounded-lg p-3 ring-1">
						<div class="text-muted-foreground text-[10px] uppercase">Rank</div>
						<div class="text-lg font-bold tabular-nums">#{selectedNFT.rarityRank}</div>
					</div>
				</div>
			</div>

			<!-- Traits -->
			<div class="space-y-3">
				<h3 class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Traits</h3>
				<div class="grid gap-2">
					{#each selectedNFT.metadata.traits as trait}
						{@const layer = trait.layer || (trait as any).trait_type || 'Attribute'}
						{@const value = trait.trait || (trait as any).value || 'None'}
						{@const isSelected = selectedTraits[layer]?.includes(value)}
						<button
							type="button"
							onclick={() => ontraitclick?.(layer, value)}
							class="ring-border flex items-center justify-between rounded-lg p-3 ring-1 transition-all {isSelected
								? 'bg-primary text-primary-foreground ring-primary shadow-sm'
								: 'bg-muted/10 hover:bg-muted/30 text-foreground'}"
						>
							<div class="min-w-0 text-left">
								<div
									class="mb-0.5 text-[10px] font-bold tracking-wider uppercase {isSelected
										? 'text-primary-foreground/90'
										: 'text-muted-foreground'}"
								>
									{layer}
								</div>
								<div class="truncate text-sm font-semibold">{value}</div>
							</div>
							<Badge
								variant={isSelected ? 'secondary' : 'outline'}
								class="shrink-0 font-mono text-[10px] {isSelected
									? 'bg-primary-foreground text-primary border-transparent'
									: 'bg-background/50'}"
							>
								{trait.rarity}%
							</Badge>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
{/snippet}

<div class={className}>
	{#if selectedNFT}
		{#if hideCard}
			{@render content()}
		{:else}
			<Card class="p-6 shadow-sm">
				{@render content()}
			</Card>
		{/if}
	{:else}
		<!-- Empty State -->
		<Card class="flex flex-col items-center justify-center p-12 text-center opacity-60">
			<div class="bg-muted mb-4 rounded-full p-4">
				<svg
					class="text-muted-foreground h-10 w-10"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="1.5" />
					<circle cx="8.5" cy="8.5" r="1.5" stroke-width="1.5" />
					<polyline points="21 15 16 10 5 21" stroke-width="1.5" />
				</svg>
			</div>
			<div class="text-foreground text-base font-medium">No NFT Selected</div>
			<div class="text-muted-foreground mt-1 text-sm">
				Select an NFT from the gallery to view its details, traits, and rarity.
			</div>
		</Card>
	{/if}
</div>
