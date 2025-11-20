<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
	import Button from '$lib/components/ui/button/button.svelte';
	import Card from '$lib/components/ui/card/card.svelte';
	import { showError, showSuccess, showWarning } from '$lib/utils/error-handling';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let isImporting = $state(false);
	let isDragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			await processFile(files[0]);
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			await processFile(files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function processFile(file: File) {
		if (!file.name.endsWith('.zip')) {
			showWarning('Please select a valid ZIP file', {
				description: 'Only ZIP files containing NFT collections can be imported.'
			});
			return;
		}

		isImporting = true;

		try {
			// Dynamically import JSZip
			const { default: JSZip } = await import('jszip');
			const zip = await JSZip.loadAsync(file);

			// Extract images and metadata
			const images: { name: string; imageData: ArrayBuffer }[] = [];
			const metadata: { name: string; data: any }[] = [];

			// Process images from the main zip object
			const allFiles = Object.keys(zip.files);
			const imageFiles = allFiles.filter(
				(filename) =>
					filename.startsWith('images/') &&
					(filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg'))
			);

			for (const filename of imageFiles) {
				const imageFile = zip.file(filename);
				if (imageFile) {
					const imageData = await imageFile.async('arraybuffer');
					images.push({
						name: filename.replace(/^images\//, '').replace(/\.(png|jpg|jpeg)$/, ''),
						imageData
					});
				}
			}

			// Process metadata folder - get all files directly from the main zip that start with 'metadata/'
			const metadataFiles = allFiles.filter(
				(filename) => filename.startsWith('metadata/') && filename.endsWith('.json')
			);

			for (const filename of metadataFiles) {
				const metadataFile = zip.file(filename);
				if (metadataFile) {
					try {
						const metadataText = await metadataFile.async('text');
						const metadataData = JSON.parse(metadataText);
						metadata.push({
							name: filename.replace('metadata/', '').replace('.json', ''),
							data: metadataData
						});
					} catch (error) {
						console.warn(`Failed to parse metadata file ${filename}:`, error);
					}
				}
			}

			if (images.length === 0) {
				showError(new Error('No valid images found in ZIP file'), {
					title: 'Import Failed',
					description: 'The ZIP file must contain an "images" folder with PNG or JPG files.'
				});
				return;
			}

			// Convert to gallery format
			const galleryNFTs = images.map((image, index) => {
				const matchingMetadata = metadata.find((meta) => meta.name === image.name);

				// Use actual metadata if found
				if (matchingMetadata) {
					return {
						name: matchingMetadata.data.name || image.name,
						imageData: image.imageData,
						metadata: {
							traits: matchingMetadata.data.attributes || [],
							description:
								matchingMetadata.data.description || `A unique ${image.name} from this collection.`
						},
						index
					};
				}

				// Create NFT with minimal metadata (no dummy data)
				return {
					name: image.name,
					imageData: image.imageData,
					metadata: {
						traits: [],
						description: `${image.name} - Generated NFT`
					},
					index
				};
			});

			// Validate import data
			const validation = galleryStore.validateImportData(galleryNFTs);
			if (!validation.isValid) {
				showError(new Error('Validation failed'), {
					title: 'Import Validation Failed',
					description: validation.errors.join('; ')
				});
				return;
			}

			// Generate collection name from file
			const collectionName = file.name
				.replace('.zip', '')
				.replace(/[-_]/g, ' ')
				.replace(/\b\w/g, (l) => l.toUpperCase());

			// Import into gallery store
			const collection = galleryStore.importCollection(
				galleryNFTs,
				collectionName,
				`Imported collection from ${file.name}`
			);

			// Calculate rarity for the collection
			const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
			galleryStore.updateCollection(collection.id, updatedCollection);

			showSuccess('Import successful', {
				description: `Imported ${galleryNFTs.length} NFTs to "${collection.name}" collection.`
			});

			// Reset file input
			if (fileInput) {
				fileInput.value = '';
			}
		} catch (error) {
			console.error('Import failed:', error);
			showError(error, {
				title: 'Import Failed',
				description:
					"Failed to process the ZIP file. Please ensure it's a valid NFT collection export."
			});
		} finally {
			isImporting = false;
		}
	}

	function triggerFileSelect() {
		fileInput?.click();
	}
</script>

<Card class="mx-auto max-w-2xl p-4 lg:max-w-3xl xl:max-w-4xl {className}">
	<div class="space-y-4">
		<h3 class="text-foreground font-semibold">Import Collection</h3>

		<div class="text-muted-foreground text-sm">
			Import previously generated NFT collections from ZIP files.
		</div>

		<!-- Drag and Drop Area -->
		<div
			class="rounded-lg border-2 border-dashed p-6 text-center transition-colors {isDragging
				? 'border-primary bg-primary/10'
				: 'border-muted-foreground/25 hover:border-muted-foreground/50'}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					triggerFileSelect();
				}
			}}
			onclick={triggerFileSelect}
		>
			<div class="space-y-2">
				<svg
					class="text-muted-foreground mx-auto h-12 w-12"
					stroke="currentColor"
					fill="none"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
						stroke-width="1"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<div class="text-foreground text-sm font-medium">
					{isImporting ? 'Importing...' : 'Drop ZIP file here or click to browse'}
				</div>
				<div class="text-muted-foreground text-xs">Supports ZIP files exported from NFT Studio</div>
			</div>

			<input
				bind:this={fileInput}
				type="file"
				accept=".zip"
				onchange={handleFileSelect}
				class="hidden"
				disabled={isImporting}
			/>
		</div>

		<!-- Alternative Button -->
		<Button
			variant="outline"
			size="sm"
			onclick={triggerFileSelect}
			disabled={isImporting}
			class="w-full"
		>
			{isImporting ? 'Importing...' : 'Select ZIP File'}
		</Button>

		<!-- Instructions -->
		<div class="text-muted-foreground space-y-1 text-xs">
			<div>
				<strong>Important:</strong> Both folders must be at the root level inside the ZIP file
			</div>
			<div class="mt-1 text-center text-xs">
				• images/ folder contains NFT images<br />
				• metadata/ folder contains JSON files<br />
				• Do not put folders inside other folders
			</div>
		</div>
	</div>
</Card>
