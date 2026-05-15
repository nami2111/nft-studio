<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { GalleryItem } from '$lib/types/gallery';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { imageUrlCache } from '$lib/utils/object-url-cache';
	import { getRarityColor } from '$lib/utils/gallery-helpers';
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import { Image01Icon } from '@hugeicons/core-free-icons';

	interface Props {
		selectedItem?: GalleryItem | null;
		class?: string;
		hideCard?: boolean;
		totalSupply?: number;
		selectedTraits?: Record<string, string[]>;
		ontraitclick?: (layer: string, value: string) => void;
	}

	const {
		selectedItem,
		class: className = '',
		hideCard = false,
		totalSupply = 100,
		selectedTraits = {},
		ontraitclick
	}: Props = $props();

	let imageUrl = $state<string | null>(null);

	$effect(() => {
		const item = selectedItem;
		if (!item) {
			imageUrl = null;
			return;
		}

		const data = item.imageData;
		if (data && (typeof data === 'string' || data.byteLength > 0)) {
			imageUrl = imageUrlCache.get(item.id, data);
			return;
		}

		// Empty imageData — fetch from IndexedDB
		imageUrl = null;
		galleryStore.getItemImage(item.id).then((buffer) => {
			if (buffer && buffer.byteLength > 0) {
				imageUrl = imageUrlCache.get(item.id, buffer);
			}
		});
	});

	function formatRarityScore(score: number): string {
		return score.toFixed(2);
	}
</script>

{#snippet emptyState(icon: Snippet, title: string, description: string)}
	<Card class="flex flex-col items-center justify-center p-12 text-center opacity-60">
		<div class="bg-muted mb-4 rounded-full p-4">
			{@render icon()}
		</div>
		<div class="text-foreground text-base font-medium">{title}</div>
		<div class="text-muted-foreground mt-1 text-sm">{description}</div>
	</Card>
{/snippet}

{#snippet imageIcon()}
	<Icon icon={Image01Icon} class="text-muted-foreground h-10 w-10" />
{/snippet}

{#snippet content()}
	{#if selectedItem}
		<div class="space-y-6">
			<!-- Item Image -->
			<div class="bg-muted/30 ring-border relative aspect-square overflow-hidden rounded-xl ring-1">
				{#if imageUrl}
					<img
						src={imageUrl}
						alt={selectedItem.name}
						class="h-full w-full object-contain transition-transform hover:scale-105"
					/>
				{:else}
					<div class="bg-muted h-full w-full animate-pulse"></div>
				{/if}
			</div>

			<!-- Item Name and Rarity -->
			<div>
				<div class="flex items-start justify-between gap-4">
					<h2 class="text-foreground text-xl font-bold tracking-tight">
						{selectedItem.name}
					</h2>
					<Badge
						variant="secondary"
						class="{getRarityColor(
							selectedItem.rarityRank,
							totalSupply
						)} shrink-0 text-xs font-bold uppercase transition-colors"
					>
						Rank #{selectedItem.rarityRank}
					</Badge>
				</div>
				{#if selectedItem.description}
					<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
						{selectedItem.description}
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
							{formatRarityScore(selectedItem.rarityScore)}
						</div>
					</div>
					<div class="bg-muted/30 ring-border rounded-lg p-3 ring-1">
						<div class="text-muted-foreground text-[10px] uppercase">Rank</div>
						<div class="text-lg font-bold tabular-nums">#{selectedItem.rarityRank}</div>
					</div>
				</div>
			</div>

			<!-- Traits -->
			<div class="space-y-3">
				<h3 class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Traits</h3>
				<div class="grid gap-2">
					{#each selectedItem.metadata.traits as trait ((trait.layer || (trait as Record<string, unknown>).trait_type || '') + ':' + (trait.trait || (trait as Record<string, unknown>).value || ''))}
						{@const layer =
							trait.layer ||
							((trait as Record<string, unknown>).trait_type as string) ||
							'Attribute'}
						{@const value =
							trait.trait || ((trait as Record<string, unknown>).value as string) || 'None'}
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
	{#if selectedItem}
		{#if hideCard}
			{@render content()}
		{:else}
			<Card class="p-6 shadow-sm">
				{@render content()}
			</Card>
		{/if}
	{:else}
		{@render emptyState(
			imageIcon,
			'No Item Selected',
			'Select an item from the gallery to view its details, traits, and rarity.'
		)}
	{/if}
</div>
