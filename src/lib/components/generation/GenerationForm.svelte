<script lang="ts">
	import { project } from '$lib/stores';
	import {
		generationState,
		startGeneration,
		pauseGeneration,
		completeGeneration,
		updateProgress,
		addPreviews,
		handleError,
		resetState
	} from '$lib/stores/generation-progress.svelte';
	import { runGeneration, cancelGeneration, type GenerationConfig, type GenerationCallbacks } from '$lib/domain/worker.service';
	import type { ErrorMessage } from '$lib/types/worker-messages';
	import { showError, showSuccess, showInfo, showWarning } from '$lib/utils/error-handling';
	import { isFlagEnabled } from '$lib/config/feature-flags';
	import { formatStorageBytes, getStoragePressure } from '$lib/storage/capabilities';
	import { MetadataStandard } from '$lib/domain/metadata/strategies';
	import { validateGenerationRequest } from '$lib/domain/generation.validation';
	import type { Layer } from '$lib/types/layer';
	import { onDestroy } from 'svelte';
	import GenerationProgress from './GenerationProgress.svelte';
	import GenerationControls from './GenerationControls.svelte';

	// ─── Local UI state ──────────────────────────────────────
	let collectionSize = $state<number | null>(100);
	let isComponentDestroyed = $state(false);

	const ESTIMATED_METADATA_BYTES_PER_ITEM = 4096;
	const SAMPLING_IMAGE_COUNT = 3;
	const SAMPLING_FALLBACK_BYTES_PER_PIXEL = 0.4;

	// ─── Derived state from store ────────────────────────────
	const isGenerating = $derived(generationState.isGenerating && !generationState.isBackground);
	const isBackground = $derived(generationState.isBackground);
	const isPaused = $derived(generationState.isPaused);
	const previews = $derived(generationState.previews);

	// ─── Lifecycle ───────────────────────────────────────────
	onDestroy(() => {
		isComponentDestroyed = true;

		// Revoke preview URLs
		for (const p of previews) {
			try { URL.revokeObjectURL(p.url); } catch { /* ignore */ }
		}

		// Move to background if still generating
		if (generationState.isGenerating && !generationState.isBackground) {
			pauseGeneration('Component unmounted — continuing in background');
			setTimeout(() => {
				if (generationState.isGenerating && isComponentDestroyed) {
					resetState();
				}
			}, 600_000);
		}
	});

	// ─── Orchestrator callbacks ──────────────────────────────
	function buildCallbacks(): GenerationCallbacks {
		return {
			onProgress(msg) {
				updateProgress(msg);

				// If in background mode, skip UI feedback
				if (isComponentDestroyed) return;

				// Status text already updated by updateProgress
			},

			onPreview(newPreviews: { index: number; url: string }[]) {
				if (!isComponentDestroyed) {
					addPreviews(newPreviews);
				}
			},

			onComplete(_result) {
				showSuccess('Generation complete', {
					description: 'Your download has started.'
				});
				completeGeneration();
			},

			onError(error: Error) {
				handleError({
					type: 'error',
					payload: { message: error.message }
				} as ErrorMessage);
				showError(error, {
					title: 'Generation Error',
					description: 'An error occurred during generation. Please try again.'
				});
			},

			onCancelled() {
				showInfo('Generation has been cancelled.');
				resetState();
			}
		};
	}

	/**
	 * Generate sample composite images and measure actual PNG sizes to estimate
	 * total storage needed. Falls back to a conservative constant if sampling fails.
	 */
	async function estimateGenerationStorageBytesBySampling(
		layers: Layer[],
		outputSize: { width: number; height: number },
		totalItems: number
	): Promise<number> {
		const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
		const sampleCombos: { order: number; imageData: ArrayBuffer }[][] = [];

		for (let s = 0; s < SAMPLING_IMAGE_COUNT; s++) {
			const combo: { order: number; imageData: ArrayBuffer }[] = [];
			for (const layer of sortedLayers) {
				if (layer.traits.length === 0) continue;
				const traitIdx = s % layer.traits.length;
				const trait = layer.traits[traitIdx];
				combo.push({ order: layer.order, imageData: trait.imageData });
			}
			sampleCombos.push(combo);
		}

		const canvas = document.createElement('canvas');
		canvas.width = outputSize.width;
		canvas.height = outputSize.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			const fallbackBytes =
				outputSize.width * outputSize.height * SAMPLING_FALLBACK_BYTES_PER_PIXEL * totalItems;
			return fallbackBytes + ESTIMATED_METADATA_BYTES_PER_ITEM * totalItems;
		}

		let totalImageBytes = 0;
		let validSamples = 0;

		for (const combo of sampleCombos) {
			try {
				ctx.clearRect(0, 0, outputSize.width, outputSize.height);

				const sortedCombo = combo.sort((a, b) => a.order - b.order);
				for (const item of sortedCombo) {
					const blob = new Blob([item.imageData], { type: 'image/png' });
					const bitmap = await createImageBitmap(blob);
					ctx.drawImage(bitmap, 0, 0, outputSize.width, outputSize.height);
					bitmap.close();
				}

				const blobSize = await new Promise<number>((resolve) => {
					canvas.toBlob((blob) => resolve(blob?.size ?? 0), 'image/png');
				});

				if (blobSize > 100) {
					totalImageBytes += blobSize;
					validSamples++;
				}
			} catch {
				// Skip failed sample
			}
		}

		const avgBytesPerImage =
			validSamples > 0
				? totalImageBytes / validSamples
				: outputSize.width * outputSize.height * SAMPLING_FALLBACK_BYTES_PER_PIXEL;

		const imageBytes = avgBytesPerImage * totalItems;
		const metadataBytes = ESTIMATED_METADATA_BYTES_PER_ITEM * totalItems;
		return imageBytes + metadataBytes;
	}

	async function hasStorageHeadroomForGeneration(
		layers: Layer[],
		outputSize: { width: number; height: number },
		totalItems: number
	): Promise<boolean> {
		if (!isFlagEnabled('enableStreamingStorage')) {
			return true;
		}

		const estimatedBytes = await estimateGenerationStorageBytesBySampling(
			layers,
			outputSize,
			totalItems
		);
		const pressure = await getStoragePressure(estimatedBytes, { headroomMultiplier: 1.25 });

		if (pressure.status === 'unknown') {
			return true;
		}

		if (pressure.status === 'insufficient') {
			showWarning('Insufficient storage', {
				description: `This generation may need about ${formatStorageBytes(pressure.bytesNeeded)} but only ${formatStorageBytes(pressure.availableBytes)} is available. Free up disk space and try again.`
			});
			return false;
		}

		if (pressure.status === 'low') {
			showWarning('Low storage space', {
				description: `This generation may need about ${formatStorageBytes(pressure.bytesNeeded)}. Only ${formatStorageBytes(pressure.availableBytes)} is currently available, so generation may fail if storage fills up.`
			});
		}

		return true;
	}

	// ─── Generate ────────────────────────────────────────────
	async function handleGenerate(event?: MouseEvent) {
		if (event) event.preventDefault();

		resetState();

		try {
			const projectData = project;

			const totalItems = collectionSize || 100;
			const validation = validateGenerationRequest({
				layers: projectData.layers,
				outputSize: projectData.outputSize,
				collectionSize: totalItems,
				strictPairConfig: projectData.strictPairConfig
			});
			if (!validation.success) {
				showWarning(validation.message, { description: validation.description });
				return;
			}
			if (!(await hasStorageHeadroomForGeneration(projectData.layers, projectData.outputSize, totalItems))) {
				return;
			}

			// Start generation state
			startGeneration({
				projectName: projectData.name || 'Untitled Collection',
				projectDescription: projectData.description || '',
				outputSize: projectData.outputSize,
				layers: projectData.layers,
				collectionSize: totalItems
			});

			// Build config
			const config: GenerationConfig = {
				layers: projectData.layers,
				collectionSize: totalItems,
				outputSize: projectData.outputSize,
				projectName: projectData.name || 'Untitled Collection',
				projectDescription: projectData.description || '',
				metadataStandard: projectData.metadataStandard || MetadataStandard.ERC721,
				strictPairConfig: projectData.strictPairConfig,
				extraData: {
					symbol: projectData.symbol,
					seller_fee_basis_points: projectData.sellerFeeBasisPoints,
					external_url: projectData.externalUrl,
					animation_url: projectData.animationUrl,
					creators: projectData.creators
				}
			};

			// Run the full pipeline — orchestrator handles everything
			await runGeneration(config, buildCallbacks());

		} catch (error) {
			showError(error, {
				title: 'Generation Failed',
				description: 'An unknown error occurred during generation. Please try again.'
			});
			resetState();
		}
	}

	// ─── Cancel ──────────────────────────────────────────────
	async function handleCancel() {
		try {
			await cancelGeneration();
			if (generationState.isGenerating) {
				resetState();
			}
		} catch (error) {
			showError(error, {
				title: 'Cancel Failed',
				description: 'Unable to stop generation. Please try again.'
			});
		}
	}
</script>

<div class="space-y-4 sm:space-y-6">
	<GenerationProgress {isBackground} {isPaused} {isGenerating} />

	<GenerationControls
		bind:collectionSize
		{isGenerating}
		{isBackground}
		onGenerate={handleGenerate}
		onCancel={handleCancel}
	/>
</div>
