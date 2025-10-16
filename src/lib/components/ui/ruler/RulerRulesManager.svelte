<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Plus, X, Settings } from 'lucide-svelte';
	import type { Trait, Layer, RulerRule } from '$lib/types/layer';
	import type { LayerId, TraitId } from '$lib/types/ids';

	interface Props {
		trait: Trait;
		layer: Layer;
		allLayers: Layer[];
		onRulesUpdate: (rules: RulerRule[]) => void;
	}

	const { trait, layer, allLayers, onRulesUpdate }: Props = $props();

	let isDialogOpen = $state(false);
	let rules = $state<RulerRule[]>(trait.rulerRules || []);
	let newRule = $state<RulerRule>({
		layerId: '' as LayerId,
		allowedTraitIds: [],
		forbiddenTraitIds: []
	});

	// Get available layers (excluding current layer)
	let availableLayers = $derived(allLayers.filter((l) => l.id !== layer.id));

	// Get traits for a specific layer
	function getTraitsForLayer(layerId: LayerId): Trait[] {
		const targetLayer = allLayers.find((l) => l.id === layerId);
		return targetLayer?.traits || [];
	}

	// Add new rule
	function addRule() {
		if (!newRule.layerId) return;

		const existingRuleIndex = rules.findIndex((r) => r.layerId === newRule.layerId);
		if (existingRuleIndex !== -1) {
			// Update existing rule
			rules[existingRuleIndex] = { ...newRule };
		} else {
			// Add new rule
			rules = [...rules, { ...newRule }];
		}

		// Reset new rule
		newRule = {
			layerId: '' as LayerId,
			allowedTraitIds: [],
			forbiddenTraitIds: []
		};

		onRulesUpdate(rules);
	}

	// Remove rule
	function removeRule(layerId: LayerId) {
		rules = rules.filter((r) => r.layerId !== layerId);
		onRulesUpdate(rules);
	}

	// Get layer name by ID
	function getLayerName(layerId: LayerId): string {
		const targetLayer = allLayers.find((l) => l.id === layerId);
		return targetLayer?.name || 'Unknown Layer';
	}

	// Get trait name by ID
	function getTraitName(traitId: TraitId): string {
		for (const l of allLayers) {
			const trait = l.traits.find((t) => t.id === traitId);
			if (trait) return trait.name;
		}
		return 'Unknown Trait';
	}
</script>

{#if trait.type === 'ruler'}
	<Dialog bind:open={isDialogOpen}>
		<DialogTrigger>
			<Button variant="ghost" size="icon" title="Manage Ruler Rules">
				<Settings class="h-4 w-4" />
			</Button>
		</DialogTrigger>
		<DialogContent class="max-h-[80vh] max-w-[90vw] overflow-y-auto md:max-w-3xl lg:max-w-4xl">
			<DialogHeader>
				<DialogTitle>Manage Ruler Rules for "{trait.name}"</DialogTitle>
			</DialogHeader>
			<div class="space-y-4">
				{#if availableLayers.length === 0}
					<p class="text-muted-foreground text-sm">
						No other layers available to create rules for.
					</p>
				{:else}
					<!-- Add New Rule -->
					<Card>
						<CardHeader>
							<CardTitle class="text-sm">Add New Rule</CardTitle>
						</CardHeader>
						<CardContent class="space-y-3">
							<div>
								<label for="target-layer" class="text-sm font-medium">Target Layer</label>
								<select
									id="target-layer"
									bind:value={newRule.layerId}
									class="border-input bg-background mt-1 block w-full rounded-md border px-3 py-2 text-sm"
								>
									<option value="">Select a layer...</option>
									{#each availableLayers as availableLayer (availableLayer.id)}
										<option value={availableLayer.id}>{availableLayer.name}</option>
									{/each}
								</select>
							</div>

							{#if newRule.layerId}
								{@const targetTraits = getTraitsForLayer(newRule.layerId)}
								{#if targetTraits.length > 0}
									<div class="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
										<div class="mb-2 flex items-center gap-2">
											<div class="bg-green-200 h-2 w-2 rounded-full dark:bg-green-400"></div>
											<h4 class="text-sm font-medium text-green-800 dark:text-green-200">
												Allowed Traits
											</h4>
											<span class="text-muted-foreground text-xs">(leave empty for all)</span>
										</div>
										<div class="flex flex-wrap gap-1">
											{#each targetTraits as targetTrait (targetTrait.id)}
												<button
													type="button"
													class="cursor-pointer border-none bg-transparent p-0"
													onclick={() => {
														if (newRule.allowedTraitIds.includes(targetTrait.id)) {
															newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														} else {
															newRule.allowedTraitIds = [
																...newRule.allowedTraitIds,
																targetTrait.id
															];
														}
													}}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															if (newRule.allowedTraitIds.includes(targetTrait.id)) {
																newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
																	(id) => id !== targetTrait.id
																);
															} else {
																newRule.allowedTraitIds = [
																	...newRule.allowedTraitIds,
																	targetTrait.id
																];
															}
														}
													}}
													aria-pressed={newRule.allowedTraitIds.includes(targetTrait.id)}
													aria-label={`Toggle ${targetTrait.name} from allowed traits`}
												>
													{#if newRule.allowedTraitIds.includes(targetTrait.id)}
														<Badge class="bg-green-600 border-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:border-green-500 dark:hover:bg-green-600">
															<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
																<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
															</svg>
															{targetTrait.name}
														</Badge>
													{:else}
														<Badge variant="outline" class="border-green-200 text-green-700 bg-white hover:border-green-400 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-gray-800 dark:hover:border-green-500 dark:hover:bg-green-900/20">
															{targetTrait.name}
														</Badge>
													{/if}
												</button>
											{/each}
										</div>
									</div>

									<div class="rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
										<div class="mb-2 flex items-center gap-2">
											<div class="bg-red-200 h-2 w-2 rounded-full dark:bg-red-400"></div>
											<h4 class="text-sm font-medium text-red-800 dark:text-red-200">
												Forbidden Traits
											</h4>
										</div>
										<div class="flex flex-wrap gap-1">
											{#each targetTraits as targetTrait (targetTrait.id)}
												<button
													type="button"
													class="cursor-pointer border-none bg-transparent p-0"
													onclick={() => {
														if (newRule.forbiddenTraitIds.includes(targetTrait.id)) {
															newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														} else {
															newRule.forbiddenTraitIds = [
																...newRule.forbiddenTraitIds,
																targetTrait.id
															];
														}
													}}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															if (newRule.forbiddenTraitIds.includes(targetTrait.id)) {
																newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
																	(id) => id !== targetTrait.id
																);
															} else {
																newRule.forbiddenTraitIds = [
																	...newRule.forbiddenTraitIds,
																	targetTrait.id
																];
															}
														}
													}}
													aria-pressed={newRule.forbiddenTraitIds.includes(targetTrait.id)}
													aria-label={`Toggle ${targetTrait.name} from forbidden traits`}
												>
													{#if newRule.forbiddenTraitIds.includes(targetTrait.id)}
														<Badge class="bg-red-600 border-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:border-red-500 dark:hover:bg-red-600">
															<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
																<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
															</svg>
															{targetTrait.name}
														</Badge>
													{:else}
														<Badge variant="outline" class="border-red-200 text-red-700 bg-white hover:border-red-400 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-gray-800 dark:hover:border-red-500 dark:hover:bg-red-900/20">
															{targetTrait.name}
														</Badge>
													{/if}
												</button>
											{/each}
										</div>
									</div>

									<Button variant="outline" onclick={addRule} size="sm" class="w-full">
										<Plus class="mr-1 h-3 w-3" />
										Add Rule
									</Button>
								{:else}
									<p class="text-muted-foreground text-sm">No traits available in this layer.</p>
								{/if}
							{/if}
						</CardContent>
					</Card>

					<!-- Existing Rules -->
					{#if rules.length > 0}
						<div class="space-y-3">
							<h3 class="text-sm font-medium">Existing Rules</h3>
							{#each rules as rule (rule.layerId)}
								<Card>
									<CardContent class="p-3">
										<div class="flex items-start justify-between">
											<div class="flex-1 space-y-3">
												<div class="text-sm font-medium">{getLayerName(rule.layerId)}</div>

												{#if rule.allowedTraitIds.length > 0}
													<div class="rounded-md bg-green-50 p-2 dark:bg-green-950/20">
														<div class="mb-1 flex items-center gap-2">
															<div class="bg-green-200 h-1.5 w-1.5 rounded-full dark:bg-green-400"></div>
															<span class="text-green-700 text-xs font-medium dark:text-green-300">Allowed:</span>
														</div>
														<div class="flex flex-wrap gap-1">
															{#each rule.allowedTraitIds as traitId (traitId)}
																<Badge variant="default" class="border-green-200 text-xs text-green-800 dark:border-green-700 dark:text-green-200"
																	>{getTraitName(traitId)}</Badge
																>
															{/each}
														</div>
													</div>
												{:else}
													<div class="rounded-md bg-green-50 p-2 dark:bg-green-950/20">
														<div class="flex items-center gap-2">
															<div class="bg-green-200 h-1.5 w-1.5 rounded-full dark:bg-green-400"></div>
															<span class="text-green-700 text-xs italic dark:text-green-300">All traits allowed</span>
														</div>
													</div>
												{/if}

												{#if rule.forbiddenTraitIds.length > 0}
													<div class="rounded-md bg-red-50 p-2 dark:bg-red-950/20">
														<div class="mb-1 flex items-center gap-2">
															<div class="bg-red-200 h-1.5 w-1.5 rounded-full dark:bg-red-400"></div>
															<span class="text-red-700 text-xs font-medium dark:text-red-300">Forbidden:</span>
														</div>
														<div class="flex flex-wrap gap-1">
															{#each rule.forbiddenTraitIds as traitId (traitId)}
																<Badge variant="destructive" class="border-red-200 text-xs dark:border-red-700"
																	>{getTraitName(traitId)}</Badge
																>
															{/each}
														</div>
													</div>
												{:else}
													<div class="rounded-md bg-red-50 p-2 dark:bg-red-950/20">
														<div class="flex items-center gap-2">
															<div class="bg-red-200 h-1.5 w-1.5 rounded-full dark:bg-red-400"></div>
															<span class="text-red-700 text-xs italic dark:text-red-300">No forbidden traits</span>
														</div>
													</div>
												{/if}
											</div>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => removeRule(rule.layerId)}
												class="h-6 w-6"
											>
												<X class="h-3 w-3" />
											</Button>
										</div>
									</CardContent>
								</Card>
							{/each}
						</div>
					{:else}
						<p class="text-muted-foreground text-sm">
							No rules defined yet. Add a rule to restrict trait combinations.
						</p>
					{/if}
				{/if}
			</div>
		</DialogContent>
	</Dialog>
{/if}
