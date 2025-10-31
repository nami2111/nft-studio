<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Modal } from '$lib/components/ui/modal';
	import { Settings, Plus, X, Info } from 'lucide-svelte';
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
	let strictPairConfig = $derived.by(() => project.strictPairConfig || {
		enabled: false,
		layerCombinations: []
	});

	// Available layers for combinations
	let availableLayers = $derived.by(() =>
		project.layers
			.filter(layer => layer.traits.length > 0)
			.sort((a, b) => a.order - b.order)
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
			description: newLayerPairDescription || generateDefaultLayerCombinationDescription(selectedLayerIds),
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
			layerCombinations: strictPairConfig.layerCombinations.filter(lc => lc.id !== layerCombinationId)
		};
		if (onupdateStrictPairConfig) {
			onupdateStrictPairConfig(newConfig);
		}
	}

	// Toggle layer combination active state
	function toggleLayerCombinationActive(layerCombinationId: string) {
		const newConfig = {
			...strictPairConfig,
			layerCombinations: strictPairConfig.layerCombinations.map(lc =>
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
			.map(layerId => {
				const layer = availableLayers.find(l => l.id === layerId);
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
		const layer = availableLayers.find(l => l.id === layerId);
		return layer?.name || 'Unknown Layer';
	}

	// Get layer traits count
	function getLayerTraitsCount(layerId: string): number {
		const layer = availableLayers.find(l => l.id === layerId);
		return layer?.traits.length || 0;
	}

	// Calculate total unique combinations possible for a layer combination
	function calculateTotalCombinations(layerCombination: LayerCombination): number {
		let total = 1;

		for (const layerId of layerCombination.layerIds) {
			const layer = availableLayers.find(l => l.id === layerId);
			if (!layer || layer.traits.length === 0) return 0;
			total *= layer.traits.length;
		}

		return total;
	}
</script>

<Card class="bg-card/95 rounded-lg border shadow-sm backdrop-blur-sm">
		<div class="border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold sm:text-lg lg:text-xl flex items-center gap-2">
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
			<div class="text-sm text-muted-foreground">
				<p>Prevent duplicate trait combinations between selected layer combinations. Each unique combination will only appear once.</p>
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
								<div class="group flex items-start justify-between rounded-lg border bg-card p-3 transition-all hover:bg-muted/50">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium text-sm leading-tight break-words">{layerCombination.description}</span>
											<Badge
												variant={layerCombination.active ? 'default' : 'secondary'}
												class="text-xs shrink-0"
											>
												{layerCombination.active ? 'Active' : 'Inactive'}
											</Badge>
											<Badge variant="outline" class="text-xs shrink-0">
												{calculateTotalCombinations(layerCombination)} combinations
											</Badge>
										</div>
									</div>

									<div class="flex items-center gap-1 ml-3 shrink-0">
										<Button
											variant="ghost"
											size="sm"
											class="h-8 w-8 p-0 opacity-60 hover:opacity-100 transition-opacity"
											onclick={() => toggleLayerCombinationActive(layerCombination.id)}
											title={layerCombination.active ? 'Deactivate' : 'Activate'}
										>
											<Info class="size-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											class="h-8 w-8 p-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
											onclick={() => removeLayerCombination(layerCombination.id)}
											title="Remove layer combination"
										>
											<X class="size-4" />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-6 px-4">
							<div class="flex flex-col items-center gap-3">
								<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
									<Settings class="size-6 text-muted-foreground" />
								</div>
								<div class="space-y-1">
									<p class="text-sm font-medium text-muted-foreground">No layer combinations configured</p>
									<p class="text-xs text-muted-foreground">Click "Add Layer Combination" to get started</p>
								</div>
							</div>
						</div>
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
			<legend id="layer-selection-label" class="text-sm font-medium mb-3">Select 2 or More Layers</legend>
			<div class="mt-3 space-y-3 max-h-60 overflow-y-auto" role="group" aria-labelledby="layer-selection-label">
				{#each availableLayers as layer}
					<div
						role="button"
						tabindex="0"
						class="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 {isLayerSelected(layer.id) ? 'bg-primary/10 border-primary' : ''}"
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
							class="rounded border-gray-300 text-primary focus:ring-primary"
							onchange={(e) => {
								e.stopPropagation();
								toggleLayerSelection(layer.id);
							}}
						/>
						<div class="flex-1">
							<div class="font-medium text-sm">{layer.name}</div>
							<div class="text-xs text-muted-foreground">{layer.traits.length} traits</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-3 text-xs text-muted-foreground">
				{#if selectedLayerIds.length >= 2}
					Selected: {selectedLayerIds.map(layerId => {
						const layer = availableLayers.find(l => l.id === layerId);
						return layer?.name || 'Unknown';
					}).join(' + ')}
					<div class="mt-1">
						<strong>{calculateTotalCombinations({
							id: 'temp',
							layerIds: selectedLayerIds,
							description: '',
							active: true
						})}</strong> unique combinations will be tracked
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
			<label for="layer-combination-description" class="text-sm font-medium">Description (optional)</label>
			<input
				id="layer-combination-description"
				type="text"
				placeholder={generateDefaultLayerCombinationDescription(selectedLayerIds)}
				bind:value={newLayerPairDescription}
				class="mt-2 w-full rounded-md border px-3 py-2 text-sm"
			/>
		</div>

		<!-- Action Buttons -->
		<div class="flex justify-end space-x-2 pt-6 mt-6 border-t-2 border-gray-300">
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
