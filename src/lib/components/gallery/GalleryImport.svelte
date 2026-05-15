<script lang="ts">
	import { galleryStore } from '$lib/stores/gallery.store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Progress } from '$lib/components/ui/progress';
	import { showError, showSuccess, showWarning } from '$lib/utils/error-handling';
	import { ZipReader, BlobReader, BlobWriter, TextWriter } from '@zip.js/zip.js';
	import { detectImageFormat } from '$lib/utils/image-format-detector';
	import Icon from '$components/shared/Icon.svelte';
	import { Folder01Icon, Alert01Icon } from '@hugeicons/core-free-icons';

	interface MetadataEntry {
		name: string;
		traits: Array<{ layer: string; trait: string; rarity: number }>;
		description: string;
		imageFormat: string;
	}

	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();

	let isImporting = $state(false);
	let isDragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let importProgress = $state(0);
	let importMessage = $state('');
	let selectedFiles = $state<File[]>([]);

	// Collection size limits - Conservative values to prevent browser freezing
	const MAX_COLLECTION_SIZE = 10000; // Maximum recommended items per collection
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
			selectedFiles = Array.from(files).filter((file) => file.name.endsWith('.zip'));
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
			selectedFiles = Array.from(files).filter((file) => file.name.endsWith('.zip'));
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
		const zipFiles = files.filter((f) => f.name.endsWith('.zip'));
		if (zipFiles.length === 0) {
			showWarning('No valid ZIP files', {
				description: 'Please select at least one ZIP file containing collections.'
			});
			return;
		}

		const oversizedFiles = zipFiles.filter((f) => f.size > LARGE_FILE_THRESHOLD);
		if (oversizedFiles.length > 0) {
			showWarning('Large files detected', {
				description: `${oversizedFiles.length} files exceed 2GB and will be skipped.`
			});
		}

		const validFiles = zipFiles.filter((f) => f.size <= LARGE_FILE_THRESHOLD);
		if (validFiles.length === 0) return;

		const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
		if (totalSize > MAX_TOTAL_SIZE) {
			showWarning('Total size too large', {
				description: `Total size of ${(totalSize / 1073741824).toFixed(1)}GB exceeds the limit of ${MAX_TOTAL_SIZE / 1073741824}GB.`
			});
			return;
		}

		isImporting = true;

		try {
			// Phase 1: Extract metadata from all ZIPs (text only, tiny RAM)
			importProgress = 5;
			importMessage = 'Extracting metadata...';

			const metadataList: MetadataEntry[] = [];
			const imageNamesByFile: Array<{
				file: File;
				strategy: ProcessingStrategy;
				imageNames: string[];
			}> = [];
			let totalImages = 0;

			for (let i = 0; i < validFiles.length; i++) {
				const file = validFiles[i];
				const strategy = determineProcessingStrategy(file);
				let result: { metadata: MetadataEntry[]; imageNames: string[] };

				if (strategy === 'streaming') {
					result = await extractLargeZipMetadata(file);
				} else {
					result = await extractStandardZipMetadata(file);
				}

				metadataList.push(...result.metadata);
				imageNamesByFile.push({ file, strategy, imageNames: result.imageNames });
				totalImages += result.imageNames.length;

				importProgress = 5 + Math.round(((i + 1) / validFiles.length) * 15);
			}

			if (metadataList.length === 0) {
				showError(new Error('No valid metadata found'), {
					title: 'Import Failed',
					description: 'No valid JSON metadata was found in the ZIP files.'
				});
				return;
			}

			if (totalImages > MAX_COLLECTION_SIZE) {
				showWarning('Collection too large', {
					description: `${totalImages} items exceeds the limit of ${MAX_COLLECTION_SIZE} per collection.`
				});
				return;
			}

			if (totalImages > MAX_COLLECTION_SIZE * 0.8) {
				showWarning('Large collection approaching limit', {
					description: `${totalImages} items, approaching the limit of ${MAX_COLLECTION_SIZE}.`
				});
			}

			// Phase 2: Create streaming collection (metadata only in $state)
			importProgress = 25;
			importMessage = 'Creating collection...';
			// Block the grid from rendering until all images are streamed
			galleryStore.setLoading(true);
			await new Promise((r) => setTimeout(r, 0));

			let collectionName = validFiles[0].name.replace(/\.zip$/i, '');
			if (validFiles.length > 1) {
				collectionName = collectionName.replace(/_part_\d+_of_\d+$/i, '');
				collectionName = collectionName
					.replace(/_\d+$/, '')
					.replace(/[-_]/g, ' ')
					.replace(/\b\w/g, (l) => l.toUpperCase());
				collectionName += ' (Combined)';
			} else {
				collectionName = collectionName
					.replace(/_\d+$/, '')
					.replace(/[-_]/g, ' ')
					.replace(/\b\w/g, (l) => l.toUpperCase());
			}

			const collection = galleryStore.createStreamingCollection(
				metadataList,
				collectionName,
				`Imported from ${validFiles.length} ZIP file${validFiles.length > 1 ? 's' : ''}`
			);

			// Build item ID lookup: item name → item ID
			const itemIdMap = new Map<string, string>();
			for (const item of collection.items) {
				itemIdMap.set(item.name, item.id);
			}

			importProgress = 35;

			// Phase 3: Stream images one at a time to IndexedDB
			let streamedCount = 0;
			for (const { file, strategy, imageNames } of imageNamesByFile) {
				const onProgress = (count: number) => {
					streamedCount += count;
					const percent = 35 + Math.round((streamedCount / totalImages) * 60);
					const message = `Importing images... ${streamedCount}/${totalImages}`;
					importProgress = percent;
					importMessage = message;
				};

				if (strategy === 'streaming') {
					await streamLargeZipImages(file, imageNames, itemIdMap, collection.id, onProgress);
				} else {
					await streamStandardZipImages(file, imageNames, itemIdMap, collection.id, onProgress);
				}
			}

			importProgress = 95;
			importMessage = 'Finalizing...';

			showSuccess('Import successful', {
				description: `Imported ${totalImages} items to "${collection.name}".`
			});
		} catch (error) {
			console.error('Import failed:', error);
			galleryStore.setLoading(false);
			showError(error, {
				title: 'Import Failed',
				description: 'Failed to process the ZIP files.'
			});
		} finally {
			isImporting = false;
			importProgress = 0;
			importMessage = '';
			selectedFiles = [];
			if (fileInput) fileInput.value = '';
			// Clear store loading/progress so grid renders
			galleryStore.setLoading(false);
		}
	}

	function detectFormatFromName(filename: string): string {
		const lower = filename.toLowerCase();
		if (lower.endsWith('.png')) return 'png';
		if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
		if (lower.endsWith('.webp')) return 'webp';
		if (lower.endsWith('.gif')) return 'gif';
		return 'png';
	}

	function normalizeTraits(attributes: Record<string, unknown>[]): Array<{ layer: string; trait: string; rarity: number }> {
		return attributes.map((attr) => ({
			layer: (attr.trait_type as string) || (attr.layer as string) || 'Attribute',
			trait: (attr.value as string) || (attr.trait as string) || 'None',
			rarity: (attr.rarity as number) || 0
		}));
	}

	// ── Standard ZIP (JSZip): metadata extraction + image streaming ──

	async function extractStandardZipMetadata(zipFile: File): Promise<{
		metadata: MetadataEntry[];
		imageNames: string[];
	}> {
		const { default: JSZip } = await import('jszip');
		const zip = await JSZip.loadAsync(zipFile);

		const metadata: MetadataEntry[] = [];
		const imageNames: string[] = [];

		for (const [path, entry] of Object.entries(zip.files)) {
			if (entry.dir) continue;

			if (path.startsWith('metadata/') && path.endsWith('.json')) {
				try {
					const text = await entry.async('text');
					const data = JSON.parse(text);
					const name = path.replace(/^metadata\//, '').replace(/\.json$/i, '');
					const traits = normalizeTraits((data.attributes as Record<string, unknown>[]) || []);
					metadata.push({
						name,
						traits,
						description: (data.description as string) || '',
						imageFormat: 'png'
					});
				} catch {
					// Skip malformed metadata
				}
			}

			if (
				path.startsWith('images/') &&
				/\.(png|jpe?g|webp|gif)$/i.test(path)
			) {
				const name = path.replace(/^images\//, '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
				const fmt = detectFormatFromName(path);
				imageNames.push(name);

				// Update imageFormat on matching metadata entry
				const meta = metadata.find((m) => m.name === name);
				if (meta) meta.imageFormat = fmt;
			}
		}

		return { metadata, imageNames };
	}

	async function streamStandardZipImages(
		zipFile: File,
		imageNames: string[],
		itemIdMap: Map<string, string>,
		collectionId: string,
		onProgress: (count: number) => void
	): Promise<void> {
		const { default: JSZip } = await import('jszip');
		const zip = await JSZip.loadAsync(zipFile);

		// Build a name→path map from actual ZIP entries (JSZip is case-sensitive)
		const pathMap = new Map<string, string>();
		for (const [path, entry] of Object.entries(zip.files)) {
			if (entry.dir) continue;
			if (path.startsWith('images/') && /\.(png|jpe?g|webp|gif)$/i.test(path)) {
				const name = path.replace(/^images\//, '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
				pathMap.set(name, path);
			}
		}

		let count = 0;
		const batchSize = 50;

		for (let i = 0; i < imageNames.length; i += batchSize) {
			const batch = imageNames.slice(i, i + batchSize);

			for (const name of batch) {
				const itemId = itemIdMap.get(name);
				if (!itemId) continue;

				const entryPath = pathMap.get(name);
				if (!entryPath) { count++; continue; }

				const entry = zip.file(entryPath);
				if (!entry) { count++; continue; }

				try {
					const imageData = await entry.async('arraybuffer');
					if (imageData.byteLength > 0) {
						const fmt = detectImageFormat(imageData);
						await galleryStore.streamItemImage(collectionId, itemId, imageData, fmt);
					}
				} catch {
					// Skip failed entry
				}
				count++;
			}

			if (i + batchSize < imageNames.length) {
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		onProgress(count);
	}

	// ── Large ZIP (zip.js): metadata extraction + image streaming ──

	async function extractLargeZipMetadata(zipFile: File): Promise<{
		metadata: MetadataEntry[];
		imageNames: string[];
	}> {
		const reader = new ZipReader(new BlobReader(zipFile));
		const entries = await reader.getEntries();

		const metadata: MetadataEntry[] = [];
		const imageNames: string[] = [];

		for (const entry of entries) {
			if (entry.filename.startsWith('metadata/') && entry.filename.endsWith('.json')) {
				if ('getData' in entry && typeof entry.getData === 'function') {
					try {
						const text = await entry.getData(new TextWriter());
						const data = JSON.parse(text);
						const name = entry.filename.replace(/^metadata\//, '').replace(/\.json$/i, '');
						const traits = normalizeTraits((data.attributes as Record<string, unknown>[]) || []);
						metadata.push({
							name,
							traits,
							description: (data.description as string) || '',
							imageFormat: 'png'
						});
					} catch {
						// Skip malformed metadata
					}
				}
			}

			if (
				entry.filename.startsWith('images/') &&
				/\.(png|jpe?g|webp|gif)$/i.test(entry.filename)
			) {
				const name = entry.filename.replace(/^images\//, '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
				const fmt = detectFormatFromName(entry.filename);
				imageNames.push(name);

				const meta = metadata.find((m) => m.name === name);
				if (meta) meta.imageFormat = fmt;
			}
		}

		await reader.close();
		return { metadata, imageNames };
	}

	async function streamLargeZipImages(
		zipFile: File,
		imageNames: string[],
		itemIdMap: Map<string, string>,
		collectionId: string,
		onProgress: (count: number) => void
	): Promise<void> {
		const reader = new ZipReader(new BlobReader(zipFile));
		const entries = await reader.getEntries();

		const nameSet = new Set(imageNames);
		let count = 0;

		for (const entry of entries) {
			if (
				!entry.filename.startsWith('images/') ||
				!/\.(png|jpe?g|webp|gif)$/i.test(entry.filename)
			) {
				continue;
			}

			const name = entry.filename.replace(/^images\//, '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
			if (!nameSet.has(name)) continue;

			const itemId = itemIdMap.get(name);
			if (!itemId) continue;

			if ('getData' in entry && typeof entry.getData === 'function') {
				try {
					const blob = await entry.getData(new BlobWriter());
					if (blob) {
						const arrayBuffer = await blob.arrayBuffer();
						if (arrayBuffer.byteLength > 0) {
							const fmt = detectImageFormat(arrayBuffer);
							await galleryStore.streamItemImage(collectionId, itemId, arrayBuffer, fmt);
							count++;
						}
					}
				} catch {
					// Skip failed entry
				}
			}
		}

		await reader.close();
		onProgress(count);
	}
	function triggerFileSelect() {
		fileInput?.click();
	}
</script>

<Card class="mx-auto max-w-2xl p-4 lg:max-w-3xl xl:max-w-4xl {className}">
	<div class="space-y-4">
		<h3 class="text-foreground font-semibold">Import Collection</h3>

		<div class="text-muted-foreground text-sm">
			Import previously generated collections from ZIP files.
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
				<Icon icon={Folder01Icon} class="text-muted-foreground mx-auto h-12 w-12" />
				<div class="text-foreground text-sm font-medium">
					{isImporting ? 'Importing...' : 'Drop ZIP file here or click to browse'}
				</div>
				<div class="text-muted-foreground text-xs">Supports ZIP files exported from GNStudio</div>
				<div class="text-muted-foreground mt-1 text-xs">
					Tip: You can select multiple ZIP files at once (Ctrl+Click or Cmd+Click)
				</div>
				<div class="mt-1 text-xs font-medium text-orange-600 flex items-center gap-1">
					<Icon icon={Alert01Icon} class="h-3 w-3" /> Limitations: Max 10,000 items per collection, 2GB total size across all files
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
				• images/ folder contains item images<br />
				• metadata/ folder contains JSON files<br />
				• Do not put folders inside other folders<br />
				• You can select multiple ZIP files at once<br />
				• Max 10,000 items and 2GB total per import
			</div>
		</div>
	</div>
</Card>
