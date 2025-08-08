<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import {
		project,
		prepareLayersForWorker,
		hasMissingImageData,
		getLayersWithMissingImages,
		projectNeedsZipLoad
	} from '$lib/stores/project.store';
	import type { Project } from '$lib/types/project';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from 'lucide-svelte';

	let open = $state(false);
	let collectionSize = $state(100);
	let isGenerating = $state(false);
	let generatedCount = $state(0);
	let totalCount = $state(0);
	let statusText = $state('Ready to generate.');
	let worker: Worker | null = $state(null);

	let projectData: Project = $state({
		id: '',
		name: '',
		description: '',
		outputSize: { width: 1024, height: 1024 },
		layers: []
	});

	project.subscribe((p) => {
		projectData = p;
	});

	function updateProgress(generated: number, total: number, text: string) {
		generatedCount = generated;
		totalCount = total;
		statusText = text;
	}

	function resetState() {
		isGenerating = false;
		updateProgress(0, 0, 'Ready to generate.');
		if (worker) {
			worker.terminate();
			worker = null;
		}
	}

	async function packageZip(
		images: { name: string; imageData: ArrayBuffer }[],
		metadata: { name: string; data: Record<string, unknown> }[]
	) {
		updateProgress(images.length, images.length, 'Packaging files into a .zip...');
		try {
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			const imagesFolder = zip.folder('images');
			const metadataFolder = zip.folder('metadata');

			for (const file of images) {
				imagesFolder?.file(file.name, file.imageData);
			}
			for (const meta of metadata) {
				metadataFolder?.file(meta.name, JSON.stringify(meta.data, null, 2));
			}

			const content = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(content);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${projectData.name || 'collection'}.zip`;
			a.click();
			URL.revokeObjectURL(url);

			statusText = 'Download started.';
			toast.success('Generation complete. Your download has started.');
		} catch (err) {
			statusText = 'Error: Failed to create .zip file.';
			toast.error('Packaging failed. Please try again.');
			console.error(err);
		} finally {
			resetState();
		}
	}

	async function handleGenerate() {
		if (projectData.layers.length === 0) {
			toast.error('Please add at least one layer before generating.');
			return;
		}
		if (collectionSize < 1) {
			toast.error('Collection size must be at least 1.');
			return;
		}
		if (collectionSize > 10000) {
			toast.error('Collection size is limited to 10,000 items for performance.');
			return;
		}

		// Check for missing image data
		if (hasMissingImageData()) {
			const missingImages = getLayersWithMissingImages();
			const traitList = missingImages
				.slice(0, 3) // Show first 3 to avoid too many
				.map(
					(item: { layerName: string; traitName: string }) =>
						`"${item.traitName}" in layer "${item.layerName}"`
				)
				.join(', ');
			const moreText = missingImages.length > 3 ? ` and ${missingImages.length - 3} more` : '';

			toast.error(
				`Some images are missing or corrupted. Please re-upload: ${traitList}${moreText}.`
			);
			return;
		}

		isGenerating = true;
		updateProgress(0, collectionSize, 'Validating project data...');

		try {
			// Validate layers before starting generation
			const transferrableLayers = await prepareLayersForWorker(projectData.layers);

			updateProgress(0, collectionSize, 'Initializing worker...');

			worker = new Worker(new URL('$lib/workers/generation.worker.ts', import.meta.url), {
				type: 'module'
			});

			worker.onmessage = (e) => {
				const { type, payload } = e.data;
				switch (type) {
					case 'progress':
						updateProgress(payload.generatedCount, payload.totalCount, payload.statusText);
						break;
					case 'complete':
						packageZip(payload.images, payload.metadata);
						// Auto-refresh after successful generation
						setTimeout(() => {
							window.location.reload();
						}, 2500); // Wait 2.5 seconds for download to start
						break;
					case 'error':
						updateProgress(generatedCount, totalCount, `Error: ${payload.message}`);
						toast.error(`Generation error: ${payload.message}`);
						resetState();
						break;
					case 'cancelled':
						updateProgress(generatedCount, totalCount, 'Generation cancelled by user.');
						toast.info('Generation has been cancelled.');
						resetState();
						// Auto-refresh after cancellation
						setTimeout(() => {
							window.location.reload();
						}, 1500); // Wait 1.5 seconds before refresh
						break;
				}
			};

			const transfers = transferrableLayers.flatMap((layer) =>
				layer.traits
					.map((trait) => trait.imageData)
					.filter((d): d is ArrayBuffer => d instanceof ArrayBuffer)
			);

			const messageData = {
				type: 'start',
				payload: {
					layers: transferrableLayers,
					collectionSize,
					outputSize: {
						width: projectData.outputSize.width,
						height: projectData.outputSize.height
					},
					projectName: String(projectData.name || ''),
					projectDescription: String(projectData.description || '')
				}
			};

			worker.postMessage(messageData, transfers);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'An unknown error occurred.';
			updateProgress(generatedCount, totalCount, `Error: ${message}`);
			toast.error(message);
			resetState();
		}
	}

	function handleModalInteraction(newOpenState: boolean) {
		open = newOpenState;
		// If closing the modal during generation, cancel it
		if (!newOpenState && isGenerating) {
			handleCancel();
		}
	}

	function handleCancel() {
		if (worker) {
			// Send cancellation message to worker
			worker.postMessage({ type: 'cancel' });
			worker.terminate();
			worker = null;
		}
		isGenerating = false;
		updateProgress(generatedCount, totalCount, 'Generation cancelled by user.');
		toast.info('Generation has been cancelled.');
	}
</script>

<Dialog bind:open onOpenChange={handleModalInteraction}>
	<DialogTrigger>
		<Button class="mt-6">Generate Collection</Button>
	</DialogTrigger>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Generate Collection</DialogTitle>
			<DialogDescription>Configure your collection generation settings.</DialogDescription>
		</DialogHeader>

		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<label for="collectionSize" class="text-right">Collection Size</label>
				<input
					id="collectionSize"
					type="number"
					min="1"
					max="10000"
					class="col-span-3 rounded border p-2"
					bind:value={collectionSize}
					disabled={isGenerating}
				/>
			</div>

			<div class="grid grid-cols-4 items-center gap-4">
				<label class="text-right" for="gen-progress">Progress</label>
				<div class="col-span-3">
					<progress
						id="gen-progress"
						class="h-2.5 w-full [&::-moz-progress-bar]:bg-blue-600 [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-value]:bg-blue-600"
						value={generatedCount}
						max={totalCount}
					></progress>
					<p class="mt-1 text-sm text-gray-500">{statusText}</p>
				</div>
			</div>
		</div>

		<div class="flex justify-end space-x-2">
			{#if isGenerating}
				<Button variant="outline" onclick={handleCancel}>
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Cancel
				</Button>
			{/if}
			<Button
				onclick={handleGenerate}
				disabled={isGenerating || projectData.layers.length === 0 || projectNeedsZipLoad()}
			>
				{#if isGenerating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Generating...
				{:else}
					Generate
				{/if}
			</Button>
		</div>
	</DialogContent>
</Dialog>
