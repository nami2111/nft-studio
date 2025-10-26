<script lang="ts">
	import type { GalleryNFT } from '$lib/types/gallery';
	import Card from '$lib/components/ui/card/card.svelte';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';

	interface Props {
		selectedNFT?: GalleryNFT | null;
		class?: string;
	}

	let { selectedNFT, class: className = '' }: Props = $props();

	let imageUrl = $state<string | null>(null);
	let isLoadingImage = $state(false);

	// Handle image URL creation and cleanup
	$effect(() => {
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
			imageUrl = null;
		}

		if (selectedNFT) {
			isLoadingImage = true;
			// Create image URL from ArrayBuffer
			const blob = new Blob([selectedNFT.imageData], { type: 'image/png' });
			imageUrl = URL.createObjectURL(blob);
			isLoadingImage = false;
		}
	});

	// Cleanup on destroy
	$effect(() => {
		return () => {
			if (imageUrl) {
				URL.revokeObjectURL(imageUrl);
			}
		};
	});

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

	function downloadNFT() {
		if (!selectedNFT || !imageUrl) return;

		const link = document.createElement('a');
		link.href = imageUrl;
		link.download = `${selectedNFT.name}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function copyMetadata() {
		if (!selectedNFT) return;

		const metadata = {
			name: selectedNFT.name,
			description: selectedNFT.description,
			traits: selectedNFT.metadata.traits,
			rarityScore: selectedNFT.rarityScore,
			rarityRank: selectedNFT.rarityRank,
			generatedAt: selectedNFT.generatedAt
		};

		navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
	}
</script>

<div class="space-y-4 {className}">
	{#if selectedNFT}
		<Card class="p-4">
			<!-- NFT Image -->
			<div class="mb-4">
				<div class="bg-muted aspect-square overflow-hidden rounded-lg">
					{#if isLoadingImage}
						<Skeleton class="h-full w-full" />
					{:else if imageUrl}
						<img src={imageUrl} alt={selectedNFT.name} class="h-full w-full object-contain" />
					{/if}
				</div>
			</div>

			<!-- NFT Name and Rarity -->
			<div class="mb-4">
				<div class="flex items-start justify-between">
					<h2 class="text-foreground text-lg font-semibold">
						{selectedNFT.name}
					</h2>
					<Badge
						variant="secondary"
						class="{getRarityColor(
							selectedNFT.rarityRank,
							100 // TODO: Get actual total from gallery
						)} text-sm font-semibold"
					>
						#{selectedNFT.rarityRank}
					</Badge>
				</div>
				{#if selectedNFT.description}
					<p class="text-muted-foreground mt-1 text-sm">
						{selectedNFT.description}
					</p>
				{/if}
			</div>

			<!-- Rarity Information -->
			<div class="mb-4 space-y-2">
				<h3 class="text-foreground text-sm font-medium">Rarity Information</h3>
				<div class="space-y-1">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Rarity Score:</span>
						<span class="font-medium">{formatRarityScore(selectedNFT.rarityScore)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Rarity Rank:</span>
						<span class="font-medium">#{selectedNFT.rarityRank}</span>
					</div>
				</div>
			</div>

			<!-- Traits -->
			<div class="mb-4">
				<h3 class="text-foreground mb-2 text-sm font-medium">Traits</h3>
				<div class="space-y-2">
					{#each selectedNFT.metadata.traits as trait}
						<div class="flex items-center justify-between rounded-md border p-2">
							<div class="text-sm">
								<div class="text-foreground font-medium">{trait.layer}</div>
								<div class="text-muted-foreground">{trait.trait}</div>
							</div>
							<Badge variant="outline" class="text-xs">
								{trait.rarity}%
							</Badge>
						</div>
					{/each}
				</div>
			</div>

			<!-- Additional Information -->
			<div class="mb-4 space-y-2">
				<h3 class="text-foreground text-sm font-medium">Details</h3>
				<div class="space-y-1">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Collection ID:</span>
						<span class="font-mono text-xs">{selectedNFT.collectionId.slice(0, 8)}...</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Generated:</span>
						<span class="font-medium">{new Date(selectedNFT.generatedAt).toLocaleDateString()}</span
						>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				<Button size="sm" variant="outline" onclick={downloadNFT}>Download</Button>
				<Button size="sm" variant="outline" onclick={copyMetadata}>Copy Metadata</Button>
			</div>
		</Card>
	{:else}
		<!-- Empty State -->
		<Card class="p-8 text-center">
			<div class="text-muted-foreground mb-2 text-6xl">🖼️</div>
			<div class="text-muted-foreground text-sm">Select an NFT to view details</div>
		</Card>
	{/if}
</div>
