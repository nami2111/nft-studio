<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Modal } from '$lib/components/ui/modal';
	import Settings from 'lucide-svelte/icons/settings';
	import Plus from 'lucide-svelte/icons/plus';
	import X from 'lucide-svelte/icons/x';
	import Info from 'lucide-svelte/icons/info';
	import type { StrictPairConfig, LayerCombination } from '$lib/types/layer';
	import type { Layer } from '$lib/types/project';
	import type { LayerId, TraitId } from '$lib/types/ids';

	// Props
	let {
		project,
		onupdateStrictPairConfig
	}: {
		project: {
			id: string;
			name: string;
			description: string;
			outputSize: { width: number; height: number };
			layers: Layer[];
			strictPairConfig?: StrictPairConfig;
		};
		onupdateStrictPairConfig?: (config: StrictPairConfig) => void;
	} = $props();

	// State
	let isOpen = $state(false);
	let showLayerPairModal = $state(false);
	let selectedLayerIds: LayerId[] = $state([]);
	let newLayerPairDescription = $state('');

	// No event dispatcher needed - use callback prop directly

	// Reactive strict pair config
	let strictPairConfig = $derived.by(
		() =>
			project.strictPairConfig || {
				enabled: false,
				layerCombinations: []
			}
	);

	// Available layers for combinations
	let availableLayers = $derived.by(() =>
		project.layers.filter((layer) => layer.traits.length > 0).sort((a, b) => a.order - b.order)
	);

	// Toggle Strict Pair mode
	function toggleStrictPairMode() {
		const newConfig = {
			...strictPairConfig,
			enabled: !strictPairConfig.enabled
		};
		if (onupdateStrictPairConfig) {
			onupdateStrictPairConfig(newConfig);
		}
	}

	// Add new layer combination
	function addLayerCombination() {
		if (selectedLayerIds.length < 2) return;

		const layerCombination: LayerCombination = {
			id: crypto.randomUUID(),
			layerIds: [...selectedLayerIds],
			description:
				newLayerPairDescription || generateDefaultLayerCombinationDescription(selectedLayerIds),
			active: true
		};

		const newConfig = {
			...strictPairConfig,
			layerCombinations: [...strictPairConfig.layerCombinations, layerCombination]
		};

		if (onupdateStrictPairConfig) {
			onupdateStrictPairConfig(newConfig);
		}

		// Reset form
		selectedLayerIds = [];
		newLayerPairDescription = '';
		showLayerPairModal = false;
	}

	// Remove layer combination
	function removeLayerCombination(layerCombinationId: string) {
		const newConfig = {
			...strictPairConfig,
			layerCombinations: strictPairConfig.layerCombinations.filter(
				(lc) => lc.id !== layerCombinationId
			)
		};
		if (onupdateStrictPairConfig) {
			onupdateStrictPairConfig(newConfig);
		}
	}

	// Toggle layer combination active state
	function toggleLayerCombinationActive(layerCombinationId: string) {
		const newConfig = {
			...strictPairConfig,
			layerCombinations: strictPairConfig.layerCombinations.map((lc) =>
				lc.id === layerCombinationId ? { ...lc, active: !lc.active } : lc
			)
		};
		if (onupdateStrictPairConfig) {
			onupdateStrictPairConfig(newConfig);
		}
	}

	// Generate default description from layer IDs
	function generateDefaultLayerCombinationDescription(layerIds: LayerId[]): string {
		const layerNames = layerIds
			.map((layerId) => {
				const layer = availableLayers.find((l) => l.id === layerId);
				return layer?.name || 'Unknown Layer';
			})
			.join(' + ');
		return layerNames;
	}

	// Handle layer selection
	function toggleLayerSelection(layerId: LayerId) {
		const existingIndex = selectedLayerIds.indexOf(layerId);

		if (existingIndex !== -1) {
			selectedLayerIds = selectedLayerIds.filter((_, index) => index !== existingIndex);
		} else {
			selectedLayerIds = [...selectedLayerIds, layerId];
		}
	}

	// Check if a layer is selected
	function isLayerSelected(layerId: LayerId): boolean {
		return selectedLayerIds.includes(layerId);
	}

	// Get layer name by ID
	function getLayerName(layerId: string): string {
		const layer = availableLayers.find((l) => l.id === layerId);
		return layer?.name || 'Unknown Layer';
	}

	// Get layer traits count
	function getLayerTraitsCount(layerId: string): number {
		const layer = availableLayers.find((l) => l.id === layerId);
		return layer?.traits.length || 0;
	}

	// Calculate total unique combinations possible for a layer combination
	function calculateTotalCombinations(layerCombination: LayerCombination): number {
		let total = 1;

		for (const layerId of layerCombination.layerIds) {
			const layer = availableLayers.find((l) => l.id === layerId);
			if (!layer || layer.traits.length === 0) return 0;
			total *= layer.traits.length;
		}

		return total;
	}

	// Predict if strict pair will block generation for given collection size
	function predictBlocking(collectionSize: number): {
		willBlock: boolean;
		blockingCombinations: Array<{
			combination: LayerCombination;
			maxPossible: number;
			percentage: number;
		}>;
	} {
		const blockingCombinations: Array<{
			combination: LayerCombination;
			maxPossible: number;
			percentage: number;
		}> = [];

		for (const combination of strictPairConfig.layerCombinations) {
			if (!combination.active) continue;

			const maxPossible = calculateTotalCombinations(combination);
			const percentage = (maxPossible / collectionSize) * 100;

			if (maxPossible < collectionSize) {
				blockingCombinations.push({
					combination,
					maxPossible,
					percentage
				});
			}
		}

		return {
			willBlock: blockingCombinations.length > 0,
			blockingCombinations
		};
	}

	// Get combination analytics
	function getCombinationAnalytics(): {
		totalPossibleCombinations: number;
		activeCombinations: number;
		averageCombinationsPerRule: number;
	} {
		let totalPossible = 0;
		let activeCount = 0;

		for (const combination of strictPairConfig.layerCombinations) {
			if (!combination.active) continue;

			const possible = calculateTotalCombinations(combination);
			totalPossible += possible;
			activeCount++;
		}

		return {
			totalPossibleCombinations: totalPossible,
			activeCombinations: activeCount,
			averageCombinationsPerRule: activeCount > 0 ? totalPossible / activeCount : 0
		};
	}
</script>

<Card class="bg-card/95 rounded-lg border shadow-sm backdrop-blur-sm">
	<div class="border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
		<div class="flex items-center justify-between">
			<h2 class="flex items-center gap-2 text-base font-semibold sm:text-lg lg:text-xl">
				<Settings class="size-4" />
				Strict Pair Mode
			</h2>
			<Badge variant={strictPairConfig.enabled ? 'default' : 'secondary'}>
				{strictPairConfig.enabled ? 'Enabled' : 'Disabled'}
			</Badge>
		</div>
	</div>

	<CardContent class="pt-0 pb-4">
		<div class="space-y-4">
			<!-- Description -->
			<div class="text-muted-foreground text-[9px] sm:text-sm">
				<p>
					Prevent duplicate trait combinations between selected layer combinations. Each unique
					combination will only appear once.
				</p>
			</div>

			<!-- Toggle Button -->
			<Button
				variant={strictPairConfig.enabled ? 'default' : 'outline'}
				size="sm"
				class="w-full"
				onclick={toggleStrictPairMode}
			>
				{strictPairConfig.enabled ? 'Disable Strict Pair' : 'Enable Strict Pair'}
			</Button>

			{#if strictPairConfig.enabled}
				<div class="space-y-3 border-t pt-3">
					<!-- Add Layer Combination Button -->
					<Button
						variant="outline"
						size="sm"
						class="w-full"
						onclick={() => (showLayerPairModal = true)}
						disabled={availableLayers.length < 2}
					>
						<Plus class="mr-2 size-3" />
						Add Layer Combination
					</Button>

					<!-- Current Layer Combinations -->
					{#if strictPairConfig.layerCombinations.length > 0}
						<div class="space-y-3">
							<h4 class="text-sm font-medium">Layer Combinations</h4>

							{#each strictPairConfig.layerCombinations as layerCombination}
								<div class="group bg-card hover:bg-muted/50 rounded-lg border p-3 transition-all">
									<div class="space-y-2">
										<!-- Top row: Description -->
										<div class="text-sm leading-tight font-medium break-words">
											{layerCombination.description}
										</div>

										<!-- Middle row: Badges -->
										<div class="flex flex-wrap gap-2">
											<Badge
												variant={layerCombination.active ? 'default' : 'secondary'}
												class="text-xs"
											>
												{layerCombination.active ? 'Active' : 'Inactive'}
											</Badge>
											<Badge variant="outline" class="text-xs">
												{calculateTotalCombinations(layerCombination)} combinations
											</Badge>
										</div>

										<!-- Bottom row: Action buttons -->
										<div class="flex gap-2 pt-1">
											<Button
												variant={layerCombination.active ? 'default' : 'outline'}
												size="sm"
												class="h-9 flex-1 text-xs"
												onclick={() => toggleLayerCombinationActive(layerCombination.id)}
											>
												{layerCombination.active ? 'Deactivate' : 'Activate'}
											</Button>
											<Button
												variant="outline"
												size="sm"
												class="hover:bg-destructive/10 hover:text-destructive h-9 px-3 text-xs"
												onclick={() => removeLayerCombination(layerCombination.id)}
											>
												<X class="mr-1 size-3" />
												Remove
											</Button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="px-4 py-6 text-center">
							<div class="flex flex-col items-center gap-3">
								<div class="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
									<Settings class="text-muted-foreground size-6" />
								</div>
								<div class="space-y-1">
									<p class="text-muted-foreground text-sm font-medium">
										No layer combinations configured
									</p>
									<p class="text-muted-foreground text-xs">
										Click "Add Layer Combination" to get started
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- Predictive Blocking Warning -->
					{#if strictPairConfig.enabled && strictPairConfig.layerCombinations.length > 0}
						{#snippet predictiveWarning()}
							{@const prediction1000 = predictBlocking(1000)}
							{@const prediction5000 = predictBlocking(5000)}
							{@const prediction10000 = predictBlocking(10000)}

							{#if prediction1000.willBlock || prediction5000.willBlock || prediction10000.willBlock}
								<div class="border-destructive/20 bg-destructive/5 mt-3 rounded-lg border p-3">
									<div class="flex items-start gap-2">
										<div
											class="bg-destructive/20 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full"
										>
											<svg class="text-destructive h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
										<div class="flex-1 space-y-1">
											<h5 class="text-destructive text-xs font-medium">Generation Warning</h5>
											<p class="text-destructive/80 text-xs">
												Strict pair rules will block generation at certain collection sizes:
											</p>

											<div class="mt-2 space-y-1">
												{#if prediction1000.willBlock}
													<div class="text-destructive/80 text-xs">
														• 1,000 NFTs: {prediction1000.blockingCombinations[0]?.maxPossible} combinations
														available
													</div>
												{/if}

												{#if prediction5000.willBlock}
													<div class="text-destructive/80 text-xs">
														• 5,000 NFTs: {prediction5000.blockingCombinations[0]?.maxPossible} combinations
														available
													</div>
												{/if}

												{#if prediction10000.willBlock}
													<div class="text-destructive/80 text-xs">
														• 10,000 NFTs: {prediction10000.blockingCombinations[0]?.maxPossible} combinations
														available
													</div>
												{/if}
											</div>

											<div class="mt-2">
												<span class="text-destructive/70 text-xs">
													Recommendation: Max
													{(() => {
														const availableSizes = [];
														if (!prediction1000.willBlock) availableSizes.push(1000);
														if (!prediction5000.willBlock) availableSizes.push(5000);
														if (!prediction10000.willBlock) availableSizes.push(10000);
														return availableSizes.length > 0
															? `${Math.max(...availableSizes)} NFTs`
															: 'no generation possible';
													})()}
												</span>
											</div>
										</div>
									</div>
								</div>
							{/if}
						{/snippet}
						{@render predictiveWarning()}
					{/if}
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

<!-- Add Layer Combination Modal -->
<Modal
	open={showLayerPairModal}
	onClose={() => {
		showLayerPairModal = false;
		selectedLayerIds = [];
		newLayerPairDescription = '';
	}}
	title="Add Layer Combination"
>
	<div class="space-y-6">
		<!-- Layer Selection -->
		<fieldset>
			<legend id="layer-selection-label" class="mb-3 text-sm font-medium"
				>Select 2 or More Layers</legend
			>
			<div
				class="mt-3 max-h-60 space-y-3 overflow-y-auto"
				role="group"
				aria-labelledby="layer-selection-label"
			>
				{#each availableLayers as layer}
					<div
						role="button"
						tabindex="0"
						class="hover:bg-muted/50 flex cursor-pointer items-center space-x-3 rounded-lg border p-3 {isLayerSelected(
							layer.id
						)
							? 'bg-primary/10 border-primary'
							: ''}"
						onclick={() => toggleLayerSelection(layer.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggleLayerSelection(layer.id);
							}
						}}
						aria-pressed={isLayerSelected(layer.id)}
						aria-label={`Select ${layer.name} layer`}
					>
						<input
							type="checkbox"
							checked={isLayerSelected(layer.id)}
							class="text-primary focus:ring-primary rounded border-gray-300"
							onchange={(e) => {
								e.stopPropagation();
								toggleLayerSelection(layer.id);
							}}
						/>
						<div class="flex-1">
							<div class="text-sm font-medium">{layer.name}</div>
							<div class="text-muted-foreground text-xs">{layer.traits.length} traits</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="text-muted-foreground mt-3 text-xs">
				{#if selectedLayerIds.length >= 2}
					Selected: {selectedLayerIds
						.map((layerId) => {
							const layer = availableLayers.find((l) => l.id === layerId);
							return layer?.name || 'Unknown';
						})
						.join(' + ')}
					<div class="mt-1">
						<strong
							>{calculateTotalCombinations({
								id: 'temp',
								layerIds: selectedLayerIds,
								description: '',
								active: true
							})}</strong
						> unique combinations will be tracked
					</div>
				{:else if selectedLayerIds.length === 1}
					1 layer selected, please select 1 or more layers
				{:else}
					Please select 2 or more layers
				{/if}
			</div>
		</fieldset>

		<!-- Description -->
		<div>
			<label for="layer-combination-description" class="text-sm font-medium"
				>Description (optional)</label
			>
			<input
				id="layer-combination-description"
				type="text"
				placeholder={generateDefaultLayerCombinationDescription(selectedLayerIds)}
				bind:value={newLayerPairDescription}
				class="mt-2 w-full rounded-md border px-3 py-2 text-sm"
			/>
		</div>

		<!-- Action Buttons -->
		<div class="mt-6 flex justify-end space-x-2 border-t-2 border-gray-300 pt-6">
			<Button
				variant="outline"
				size="sm"
				onclick={() => {
					showLayerPairModal = false;
					selectedLayerIds = [];
					newLayerPairDescription = '';
				}}
			>
				Cancel
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={addLayerCombination}
				disabled={selectedLayerIds.length < 2}
			>
				Add Layer Combination
			</Button>
		</div>
	</div>
</Modal>
