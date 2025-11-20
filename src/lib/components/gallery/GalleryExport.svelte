<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { exportRarityData } from '$lib/domain/rarity-calculator';
	import Button from '$lib/components/ui/button/button.svelte';
	import Card from '$lib/components/ui/card/card.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let selectedCollection = $derived(galleryStore.selectedCollection);
	let isExporting = $state(false);

	async function exportCollectionAsJSON() {
		if (!selectedCollection) return;

		isExporting = true;
		try {
			const collection = galleryStore.exportCollection(selectedCollection.id);
			const rarityData = exportRarityData(collection);

			const blob = new Blob([JSON.stringify(rarityData, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${collection.name}-rarity-data.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export failed:', error);
		} finally {
			isExporting = false;
		}
	}

	async function exportCollectionAsZIP() {
		if (!selectedCollection) return;

		isExporting = true;
		try {
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			const collection = galleryStore.exportCollection(selectedCollection.id);

			// Add images folder
			const imagesFolder = zip.folder('images');
			for (const nft of collection.nfts) {
				const blob = new Blob([nft.imageData], { type: 'image/png' });
				imagesFolder?.file(`${nft.name}.png`, blob);
			}

			// Add metadata folder
			const metadataFolder = zip.folder('metadata');
			for (const nft of collection.nfts) {
				const metadata = {
					name: nft.name,
					description: nft.description,
					traits: nft.metadata.traits,
					rarityScore: nft.rarityScore,
					rarityRank: nft.rarityRank,
					generatedAt: nft.generatedAt
				};
				metadataFolder?.file(`${nft.name}.json`, JSON.stringify(metadata, null, 2));
			}

			// Add rarity data
			const rarityData = exportRarityData(collection);
			zip.file('rarity-analysis.json', JSON.stringify(rarityData, null, 2));

			// Generate and download zip
			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${collection.name}-complete.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export failed:', error);
		} finally {
			isExporting = false;
		}
	}

	function exportSelectedNFTs() {
		// TODO: Implement selected NFTs export
		console.log('Export selected NFTs - not implemented yet');
	}
</script>

<Card class="p-4 {className}">
	<div class="space-y-4">
		<h3 class="text-foreground font-semibold">Export Gallery</h3>

		{#if selectedCollection}
			<div class="space-y-3">
				<div class="text-muted-foreground text-sm">
					Exporting: <span class="text-foreground font-medium">{selectedCollection.name}</span>
					({selectedCollection.totalSupply} NFTs)
				</div>

				<div class="flex flex-col gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={exportCollectionAsJSON}
						disabled={isExporting}
					>
						{isExporting ? 'Exporting...' : 'Export Rarity Data (JSON)'}
					</Button>

					<Button
						variant="outline"
						size="sm"
						onclick={exportCollectionAsZIP}
						disabled={isExporting}
					>
						{isExporting ? 'Exporting...' : 'Export Complete Collection (ZIP)'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="text-muted-foreground text-sm">Select a collection to export its data</div>
		{/if}
	</div>
</Card>
