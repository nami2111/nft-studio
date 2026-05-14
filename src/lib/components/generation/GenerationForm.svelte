<script lang="ts">
	import { project } from '$lib/stores';
	import { runGeneration, cancelGeneration, type GenerationConfig, type GenerationCallbacks } from '$lib/domain/worker.service';
	import type { ProgressMessage, ErrorMessage } from '$lib/types/worker-messages';
	import { showError, showSuccess, showInfo, showWarning } from '$lib/utils/error-handling';
	import { getErrorInfo } from '$lib/utils/typed-errors';
	import {
		generationState,
		startGeneration,
		pauseGeneration,
		completeGeneration,
		resetState,
		updateProgress,
		addPreviews,
		handleError
	} from '$lib/stores/generation-progress.svelte';
	import { MetadataStandard } from '$lib/domain/metadata/strategies';
	import { onDestroy } from 'svelte';
	import GenerationProgress from './GenerationProgress.svelte';
	import GenerationControls from './GenerationControls.svelte';

	// ─── Local UI state ──────────────────────────────────────
	let collectionSize = $state<number | null>(100);
	let isComponentDestroyed = $state(false);

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
			onProgress(msg: ProgressMessage) {
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

	// ─── Generate ────────────────────────────────────────────
	async function handleGenerate(event?: MouseEvent) {
		if (event) event.preventDefault();

		resetState();

		try {
			const projectData = project;

			// Validate project
			if (projectData.layers.length === 0) {
				showWarning('Project must have at least one layer.', { description: 'Validation Error' });
				return;
			}
			if (projectData.outputSize.width <= 0 || projectData.outputSize.height <= 0) {
				showWarning('Project output size not set. Please upload an image first.', { description: 'Validation Error' });
				return;
			}
			const emptyLayers = projectData.layers.filter((l) => l.traits.length === 0);
			if (emptyLayers.length > 0) {
				showWarning(`The following layers have no traits: ${emptyLayers.map((l) => l.name).join(', ')}`, { description: 'Validation Error' });
				return;
			}
			const missingImages = projectData.layers.flatMap((l) =>
				l.traits.filter((t) => !t.imageData || t.imageData.byteLength === 0)
			);
			if (missingImages.length > 0) {
				showWarning('Missing image data. Please upload images for all traits.', { description: 'Validation Error' });
				return;
			}

			// Start generation state
			startGeneration({
				projectName: projectData.name || 'Untitled Collection',
				projectDescription: projectData.description || '',
				outputSize: projectData.outputSize,
				layers: projectData.layers,
				collectionSize: collectionSize || 100
			});

			// Build config
			const config: GenerationConfig = {
				layers: projectData.layers,
				collectionSize: collectionSize || 100,
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
	function handleCancel() {
		cancelGeneration();
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
