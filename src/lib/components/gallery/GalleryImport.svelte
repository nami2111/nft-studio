<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { updateCollectionWithRarity, RarityMethod } from '$lib/domain/rarity-calculator';
	import Button from '$lib/components/ui/button/button.svelte';
	import Card from '$lib/components/ui/card/card.svelte';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import { showError, showSuccess, showWarning } from '$lib/utils/error-handling';
	import { ZipReader, BlobReader, BlobWriter, TextWriter, type Entry } from '@zip.js/zip.js';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let isImporting = $state(false);
	let isDragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let importProgress = $state(0);
	let importMessage = $state('');
	let selectedFiles = $state<File[]>([]);
	let currentFileIndex = $state(0);

	// Collection size limits - Conservative values to prevent browser freezing
	const MAX_COLLECTION_SIZE = 10000; // Maximum recommended NFTs per collection
	const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB total across all files

	// File size thresholds (in bytes)
	const SMALL_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
	const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB

	type ProcessingStrategy = 'standard' | 'streaming' | 'too-large';

	function determineProcessingStrategy(file: File): ProcessingStrategy {
		if (file.size > LARGE_FILE_THRESHOLD) {
			return 'too-large';
		} else if (file.size > SMALL_FILE_THRESHOLD) {
			return 'streaming';
		}
		return 'standard';
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			selectedFiles = Array.from(files).filter(file => file.name.endsWith('.zip'));
			if (selectedFiles.length > 0) {
				await processFiles(selectedFiles);
			}
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			selectedFiles = Array.from(files).filter(file => file.name.endsWith('.zip'));
			if (selectedFiles.length > 0) {
				await processFiles(selectedFiles);
			}
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

	async function processFiles(files: File[]) {
		// Validate all files are ZIP files
		const invalidFiles = files.filter(file => !file.name.endsWith('.zip'));
		if (invalidFiles.length > 0) {
			showWarning('Invalid files detected', {
				description: `${invalidFiles.length} non-ZIP files will be skipped. Only ZIP files are supported.`
			});
		}

		const zipFiles = files.filter(file => file.name.endsWith('.zip'));
		if (zipFiles.length === 0) {
			showWarning('No valid ZIP files', {
				description: 'Please select at least one ZIP file containing NFT collections.'
			});
			return;
		}

		// Check for oversized files
		const oversizedFiles = zipFiles.filter(file => file.size > LARGE_FILE_THRESHOLD);
		if (oversizedFiles.length > 0) {
			showWarning('Large files detected', {
				description: `${oversizedFiles.length} files exceed 2GB and will be skipped. Please split large collections.`
			});
		}

		const validFiles = zipFiles.filter(file => file.size <= LARGE_FILE_THRESHOLD);
		if (validFiles.length === 0) {
			return;
		}

		// Check total size across all files
		const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
		if (totalSize > MAX_TOTAL_SIZE) {
			showWarning('Total size too large', {
				description: `Total size of ${(totalSize / 1024 / 1024 / 1024).toFixed(1)}GB exceeds the recommended limit of ${(MAX_TOTAL_SIZE / 1024 / 1024 / 1024).toFixed(0)}GB. Please upload fewer files at once.`
			});
			return;
		}

		isImporting = true;
		currentFileIndex = 0;

		// Aggregate data from all files
		const allImages: { name: string; imageData: ArrayBuffer | string; isBlobUrl?: boolean }[] = [];
		const allMetadata: { name: string; data: any }[] = [];
		let totalProcessedFiles = 0;

		try {
			// Process files sequentially to avoid memory issues
			for (let i = 0; i < validFiles.length; i++) {
				const file = validFiles[i];
				currentFileIndex = i + 1;
				importMessage = `Processing file ${i + 1} of ${validFiles.length}: ${file.name}`;
				importProgress = Math.round((i / validFiles.length) * 20); // First 20% for file processing

				const strategy = determineProcessingStrategy(file);

				if (strategy === 'streaming') {
					// Process large file with streaming
					const result = await processLargeZipFile(file);
					allImages.push(...result.images);
					allMetadata.push(...result.metadata);
				} else {
					// Process standard file
					const result = await processStandardZipFile(file);
					allImages.push(...result.images);
					allMetadata.push(...result.metadata);
				}

				totalProcessedFiles++;
			}

			if (allImages.length === 0) {
				showError(new Error('No valid images found'), {
					title: 'Import Failed',
					description: 'No valid images were found in the selected ZIP files.'
				});
				return;
			}

			// Check if collection size exceeds maximum limit
			if (allImages.length > MAX_COLLECTION_SIZE) {
				showWarning('Collection too large', {
					description: `This collection contains ${allImages.length} NFTs, which exceeds the maximum limit of ${MAX_COLLECTION_SIZE}. Please split your collection into smaller parts.`
				});
				return;
			}

			// Early warning for large collections (at 80% of limit)
			if (allImages.length > MAX_COLLECTION_SIZE * 0.8) {
				showWarning('Large collection approaching limit', {
					description: `This collection contains ${allImages.length} NFTs, approaching the limit of ${MAX_COLLECTION_SIZE}. Consider splitting into smaller collections for better performance.`
				});
			}

			// Convert to gallery format
			importProgress = 80;
			importMessage = 'Creating collection...';
			await new Promise(resolve => setTimeout(resolve, 0));

			const galleryNFTs = allImages.map((image, index) => {
				const matchingMetadata = allMetadata.find((meta) => meta.name === image.name);

				return {
					name: matchingMetadata?.data.name || image.name,
					imageData: image.imageData,
					metadata: {
						traits: matchingMetadata?.data.attributes || [],
						description: matchingMetadata?.data.description || `${image.name} - Generated NFT`
					},
					index,
					isBlobUrl: image.isBlobUrl
				};
			});

			// Generate collection name from first file
			const collectionName = validFiles[0].name
				.replace(/_\d+\.zip$/, '') // Remove _01, _02 etc
				.replace('.zip', '')
				.replace(/[-_]/g, ' ')
				.replace(/\b\w/g, (l) => l.toUpperCase()) + ' (Combined)';

			// Import into gallery store
			importProgress = 90;
			importMessage = 'Finalizing collection...';
			await new Promise(resolve => setTimeout(resolve, 0));

			const collection = galleryStore.importCollection(
				galleryNFTs,
				collectionName,
				`Imported collection from ${validFiles.length} ZIP files`
			);

			// Calculate rarity for the collection
			const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
			galleryStore.updateCollection(collection.id, updatedCollection);

			showSuccess('Import successful', {
				description: `Imported ${galleryNFTs.length} NFTs from ${totalProcessedFiles} ZIP files to "${collection.name}".`
			});

		} catch (error) {
			console.error('Import failed:', error);
			showError(error, {
				title: 'Import Failed',
				description: 'Failed to process the ZIP files. Please ensure they are valid NFT collection exports.'
			});
		} finally {
			isImporting = false;
			importProgress = 0;
			importMessage = '';
			selectedFiles = [];
			currentFileIndex = 0;
			// Reset file input
			if (fileInput) {
				fileInput.value = '';
			}
		}
	}

async function processStandardZipFile(file: File): Promise<{ images: any[], metadata: any[] }> {
	const { default: JSZip } = await import('jszip');
	const zip = await JSZip.loadAsync(file);

	const images: { name: string; imageData: ArrayBuffer }[] = [];
	const metadata: { name: string; data: any }[] = [];

	// Process images from the main zip object
	const allFiles = Object.keys(zip.files);
	const imageFiles = allFiles.filter(
		(filename) =>
			filename.startsWith('images/') &&
			(filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg'))
	);
	const metadataFiles = allFiles.filter(
		(filename) => filename.startsWith('metadata/') && filename.endsWith('.json')
	);

	// Process files in batches
	const batchSize = 100;

	// Process images in batches
	for (let i = 0; i < imageFiles.length; i += batchSize) {
		const batch = imageFiles.slice(i, i + batchSize);

		for (const filename of batch) {
			const imageFile = zip.file(filename);
			if (imageFile) {
				const imageData = await imageFile.async('arraybuffer');
				images.push({
					name: filename.replace(/^images\//, '').replace(/\.(png|jpg|jpeg)$/, ''),
					imageData
				});
			}
		}
	}

	// Process metadata in batches
	for (let i = 0; i < metadataFiles.length; i += batchSize) {
		const batch = metadataFiles.slice(i, i + batchSize);

		for (const filename of batch) {
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
	}

	return { images, metadata };
}

async function processLargeZipFile(file: File): Promise<{ images: any[], metadata: any[] }> {
	const zipReader = new ZipReader(new BlobReader(file));
	const entries = await zipReader.getEntries();

	const images: { name: string; blobUrl: string }[] = [];
	const metadata: { name: string; data: any }[] = [];

	// Process entries in batches
	const batchSize = 100;

	for (let i = 0; i < entries.length; i += batchSize) {
		const batch = entries.slice(i, i + batchSize);
		const batchImages: { name: string; blobUrl: string }[] = [];
		const batchMetadata: { name: string; data: any }[] = [];

		// Process images in this batch
		for (const entry of batch) {
			if (entry.filename.startsWith('images/') &&
				(entry.filename.endsWith('.png') || entry.filename.endsWith('.jpg') || entry.filename.endsWith('.jpeg'))) {

				try {
					// Check if entry has getData method (it's a file, not directory)
					if ('getData' in entry && typeof entry.getData === 'function') {
						const blob = await entry.getData(new BlobWriter());
						if (blob) {
							const blobUrl = URL.createObjectURL(blob);
							batchImages.push({
								name: entry.filename.replace(/^images\//, '').replace(/\.(png|jpg|jpeg)$/, ''),
								blobUrl
							});
						}
					}
				} catch (error) {
					console.warn(`Failed to process image ${entry.filename}:`, error);
				}
			}

			// Process metadata in this batch
			if (entry.filename.startsWith('metadata/') && entry.filename.endsWith('.json')) {
				try {
					// Check if entry has getData method (it's a file, not directory)
					if ('getData' in entry && typeof entry.getData === 'function') {
						const text = await entry.getData(new TextWriter());
						if (text) {
							const metadataData = JSON.parse(text);
							batchMetadata.push({
								name: entry.filename.replace('metadata/', '').replace('.json', ''),
								data: metadataData
							});
						}
					}
				} catch (error) {
					console.warn(`Failed to parse metadata file ${entry.filename}:`, error);
				}
			}
		}

		// Merge batch results
		images.push(...batchImages);
		metadata.push(...batchMetadata);

		// Memory cleanup between batches
		if (i + batchSize < entries.length) {
			// Force garbage collection hint
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}

	await zipReader.close();

	return {
		images: images.map(img => ({ ...img, imageData: img.blobUrl, isBlobUrl: true })),
		metadata
	};
}

async function processFile(file: File) {
	// Delegate to processFiles for single file processing
	await processFiles([file]);
}

	function triggerFileSelect() {
		fileInput?.click();
	}

	async function processLargeZip(file: File): Promise<void> {
		const zipReader = new ZipReader(new BlobReader(file));
		const entries = await zipReader.getEntries();

		const images: { name: string; blobUrl: string }[] = [];
		const metadata: { name: string; data: any }[] = [];

		// Process entries in batches
		const batchSize = 100;
		let processedCount = 0;
		const totalEntries = entries.length;

		for (let i = 0; i < entries.length; i += batchSize) {
			const batch = entries.slice(i, i + batchSize);
			const batchImages: { name: string; blobUrl: string }[] = [];
			const batchMetadata: { name: string; data: any }[] = [];

			// Process images in this batch
			for (const entry of batch) {
				if (entry.filename.startsWith('images/') &&
					(entry.filename.endsWith('.png') || entry.filename.endsWith('.jpg') || entry.filename.endsWith('.jpeg'))) {

					try {
						// Check if entry has getData method (it's a file, not directory)
						if ('getData' in entry && typeof entry.getData === 'function') {
							const blob = await entry.getData(new BlobWriter());
							if (blob) {
								const blobUrl = URL.createObjectURL(blob);
								batchImages.push({
									name: entry.filename.replace(/^images\//, '').replace(/\.(png|jpg|jpeg)$/, ''),
									blobUrl
								});
							}
						}
					} catch (error) {
						console.warn(`Failed to process image ${entry.filename}:`, error);
					}
				}

				// Process metadata in this batch
				if (entry.filename.startsWith('metadata/') && entry.filename.endsWith('.json')) {
					try {
						// Check if entry has getData method (it's a file, not directory)
						if ('getData' in entry && typeof entry.getData === 'function') {
							const text = await entry.getData(new TextWriter());
							if (text) {
								const metadataData = JSON.parse(text);
								batchMetadata.push({
									name: entry.filename.replace('metadata/', '').replace('.json', ''),
									data: metadataData
								});
							}
						}
					} catch (error) {
						console.warn(`Failed to parse metadata file ${entry.filename}:`, error);
					}
				}
			}

			// Merge batch results
			images.push(...batchImages);
			metadata.push(...batchMetadata);

			processedCount += batch.length;
			importProgress = Math.round((processedCount / totalEntries) * 50); // First 50% for extraction
			importMessage = `Processing files... ${processedCount}/${totalEntries} (Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)})`;

			// Memory cleanup between batches
			if (i + batchSize < entries.length) {
				// Force garbage collection hint
				await new Promise(resolve => setTimeout(resolve, 10));
			}
		}

		await zipReader.close();

		if (images.length === 0) {
			throw new Error('No valid images found in ZIP file');
		}

		// Convert to gallery format with blob URLs
		importProgress = 60;
		importMessage = 'Converting to gallery format...';
		await new Promise(resolve => setTimeout(resolve, 0));

		const galleryNFTs = images.map((image, index) => {
			const matchingMetadata = metadata.find((meta) => meta.name === image.name);

			return {
				name: matchingMetadata?.data.name || image.name,
				imageData: image.blobUrl, // Store blob URL instead of ArrayBuffer
				metadata: {
					traits: matchingMetadata?.data.attributes || [],
					description: matchingMetadata?.data.description || `${image.name} - Generated NFT`
				},
				index,
				isBlobUrl: true // Flag to indicate this is a blob URL
			};
		});

		// Import into gallery store
		importProgress = 75;
		importMessage = 'Importing to gallery...';
		await new Promise(resolve => setTimeout(resolve, 0));

		const collectionName = file.name
			.replace('.zip', '')
			.replace(/[-_]/g, ' ')
			.replace(/\b\w/g, (l) => l.toUpperCase());

		const collection = galleryStore.importCollection(
			galleryNFTs,
			collectionName,
			`Imported collection from ${file.name}`
		);

		// Calculate rarity for the collection
		importProgress = 90;
		importMessage = 'Calculating rarity...';
		await new Promise(resolve => setTimeout(resolve, 0));

		const updatedCollection = updateCollectionWithRarity(collection, RarityMethod.TRAIT_RARITY);
		galleryStore.updateCollection(collection.id, updatedCollection);

		// Clean up blob URLs when collection is removed
		const originalRemove = galleryStore.removeCollection.bind(galleryStore);
		galleryStore.removeCollection = function(id: string) {
			if (id === collection.id) {
				galleryNFTs.forEach(nft => {
					if (nft.isBlobUrl && nft.imageData) {
						URL.revokeObjectURL(nft.imageData);
					}
				});
			}
			return originalRemove(id);
		};

		showSuccess('Import successful', {
			description: `Imported ${galleryNFTs.length} NFTs to "${collection.name}" collection using streaming.`
		});
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
				<div class="text-muted-foreground mt-1 text-xs">Tip: You can select multiple ZIP files at once (Ctrl+Click or Cmd+Click)</div>
				<div class="text-orange-600 mt-1 text-xs font-medium">
					⚠️ Limitations: Max 10,000 NFTs per collection, 2GB total size across all files
				</div>
				{#if isImporting && importMessage}
					<div class="text-muted-foreground mt-2 text-xs">{importMessage}</div>
					<Progress value={importProgress} class="mt-2" />
				{/if}
			</div>

			<input
				bind:this={fileInput}
				type="file"
				accept=".zip"
				onchange={handleFileSelect}
				class="hidden"
				disabled={isImporting}
				multiple
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
				• Do not put folders inside other folders<br />
				• You can select multiple ZIP files at once<br />
				• Max 10,000 NFTs and 2GB total per import
			</div>
		</div>
	</div>
</Card>
