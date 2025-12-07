<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Modal } from '$lib/components/ui/modal';
	import { Badge } from '$lib/components/ui/badge';
	import Plus from 'lucide-svelte/icons/plus';
	import X from 'lucide-svelte/icons/x';
	import Settings from 'lucide-svelte/icons/settings';
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
	let rules = $derived(trait.rulerRules || []);
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

	// Check if a rule has conflicts
	function hasConflicts(rule: RulerRule): boolean {
		return rule.allowedTraitIds.some((id) => rule.forbiddenTraitIds.includes(id));
	}

	// Clean up conflicts in a rule
	function cleanRuleConflicts(rule: RulerRule): RulerRule {
		return cleanupConflicts(rule);
	}

	// Add new rule
	function addRule() {
		if (!newRule.layerId) return;

		// Clean up any conflicts before saving
		const cleanRule = cleanRuleConflicts(newRule);

		const existingRuleIndex = rules.findIndex((r) => r.layerId === cleanRule.layerId);
		if (existingRuleIndex !== -1) {
			// Update existing rule
			rules[existingRuleIndex] = { ...cleanRule };
		} else {
			// Add new rule
			rules = [...rules, { ...cleanRule }];
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

	// Clean up conflicts in existing rules (run once when component loads)
	function cleanupConflicts(rule: RulerRule): RulerRule {
		const conflicts = rule.allowedTraitIds.filter((id) => rule.forbiddenTraitIds.includes(id));
		if (conflicts.length > 0) {
			// Remove conflicted traits from forbidden list (prioritize allowed)
			return {
				...rule,
				forbiddenTraitIds: rule.forbiddenTraitIds.filter((id) => !conflicts.includes(id))
			};
		}
		return rule;
	}

	// Clean up conflicts when rules are loaded
	$effect(() => {
		if (trait.rulerRules) {
			rules = trait.rulerRules.map(cleanupConflicts);
		}
	});
</script>

{#if trait.type === 'ruler'}
	<Button
		variant="ghost"
		size="icon"
		title="Manage Ruler Rules"
		onclick={() => (isDialogOpen = true)}
	>
		<Settings class="h-4 w-4" />
	</Button>

	<Modal
		bind:open={isDialogOpen}
		title="Manage Ruler Rules for '{trait.name}'"
		onClose={() => (isDialogOpen = false)}
		maxWidth="max-w-4xl"
	>
		<div class="space-y-4">
			{#if availableLayers.length === 0}
				<p class="text-muted-foreground text-sm">No other layers available to create rules for.</p>
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
										<div class="h-2 w-2 rounded-full bg-green-200 dark:bg-green-400"></div>
										<h4 class="text-sm font-medium text-green-800 dark:text-green-200">
											Allowed Traits
										</h4>
										<span class="text-muted-foreground text-xs">(leave empty for all)</span>
										{#if newRule.allowedTraitIds.some( (id) => newRule.forbiddenTraitIds.includes(id) )}
											<span class="ml-auto text-xs text-amber-600 dark:text-amber-400">
												⚠️ Auto-resolving conflicts
											</span>
										{/if}
									</div>
									<div class="flex flex-wrap gap-1">
										{#each targetTraits as targetTrait (targetTrait.id)}
											{@const isInAllowed = newRule.allowedTraitIds.includes(targetTrait.id)}
											{@const isInForbidden = newRule.forbiddenTraitIds.includes(targetTrait.id)}
											<button
												type="button"
												class="cursor-pointer border-none bg-transparent p-0"
												onclick={() => {
													if (isInAllowed) {
														// Remove from allowed list
														newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
															(id) => id !== targetTrait.id
														);
													} else {
														// Add to allowed list and remove from forbidden list (prevent conflicts)
														newRule.allowedTraitIds = [...newRule.allowedTraitIds, targetTrait.id];
														newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
															(id) => id !== targetTrait.id
														);
													}
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														if (isInAllowed) {
															// Remove from allowed list
															newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														} else {
															// Add to allowed list and remove from forbidden list (prevent conflicts)
															newRule.allowedTraitIds = [
																...newRule.allowedTraitIds,
																targetTrait.id
															];
															newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														}
													}
												}}
												aria-pressed={isInAllowed}
												aria-label={`Toggle ${targetTrait.name} from allowed traits`}
											>
												{#if isInAllowed}
													<Badge
														class="border-green-600 bg-green-600 text-white hover:bg-green-700 dark:border-green-500 dark:bg-green-500 dark:hover:bg-green-600"
													>
														<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
															<path
																fill-rule="evenodd"
																d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																clip-rule="evenodd"
															/>
														</svg>
														{targetTrait.name}
													</Badge>
												{:else if isInForbidden}
													<Badge
														variant="outline"
														class="border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-500 dark:hover:bg-amber-950/50"
													>
														{targetTrait.name}
													</Badge>
												{:else}
													<Badge
														variant="outline"
														class="border-green-200 bg-white text-green-700 hover:border-green-400 hover:bg-green-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-500 dark:hover:bg-green-900/20"
													>
														{targetTrait.name}
													</Badge>
												{/if}
											</button>
										{/each}
									</div>
								</div>

								<div class="rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
									<div class="mb-2 flex items-center gap-2">
										<div class="h-2 w-2 rounded-full bg-red-200 dark:bg-red-400"></div>
										<h4 class="text-sm font-medium text-red-800 dark:text-red-200">
											Forbidden Traits
										</h4>
										{#if newRule.forbiddenTraitIds.some( (id) => newRule.allowedTraitIds.includes(id) )}
											<span class="ml-auto text-xs text-amber-600 dark:text-amber-400">
												⚠️ Auto-resolving conflicts
											</span>
										{/if}
									</div>
									<div class="flex flex-wrap gap-1">
										{#each targetTraits as targetTrait (targetTrait.id)}
											{@const isInAllowed = newRule.allowedTraitIds.includes(targetTrait.id)}
											{@const isInForbidden = newRule.forbiddenTraitIds.includes(targetTrait.id)}
											<button
												type="button"
												class="cursor-pointer border-none bg-transparent p-0"
												onclick={() => {
													if (isInForbidden) {
														// Remove from forbidden list
														newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
															(id) => id !== targetTrait.id
														);
													} else {
														// Add to forbidden list and remove from allowed list (prevent conflicts)
														newRule.forbiddenTraitIds = [
															...newRule.forbiddenTraitIds,
															targetTrait.id
														];
														newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
															(id) => id !== targetTrait.id
														);
													}
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														if (isInForbidden) {
															// Remove from forbidden list
															newRule.forbiddenTraitIds = newRule.forbiddenTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														} else {
															// Add to forbidden list and remove from allowed list (prevent conflicts)
															newRule.forbiddenTraitIds = [
																...newRule.forbiddenTraitIds,
																targetTrait.id
															];
															newRule.allowedTraitIds = newRule.allowedTraitIds.filter(
																(id) => id !== targetTrait.id
															);
														}
													}
												}}
												aria-pressed={isInForbidden}
												aria-label={`Toggle ${targetTrait.name} from forbidden traits`}
											>
												{#if isInForbidden}
													<Badge
														class="border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-600"
													>
														<svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
															<path
																fill-rule="evenodd"
																d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
																clip-rule="evenodd"
															/>
														</svg>
														{targetTrait.name}
													</Badge>
												{:else if isInAllowed}
													<Badge
														variant="outline"
														class="border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-500 dark:hover:bg-amber-950/50"
													>
														{targetTrait.name}
													</Badge>
												{:else}
													<Badge
														variant="outline"
														class="border-red-200 bg-white text-red-700 hover:border-red-400 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-500 dark:hover:bg-red-900/20"
													>
														{targetTrait.name}
													</Badge>
												{/if}
											</button>
										{/each}
									</div>
								</div>

								{@const hasCurrentConflicts = hasConflicts(newRule)}
								{@const buttonClass = hasCurrentConflicts
									? 'w-full border-amber-300 bg-amber-50 text-amber-700'
									: 'w-full'}
								<Button variant="outline" onclick={addRule} size="sm" class={buttonClass}>
									<Plus class="mr-1 h-3 w-3" />
									Add Rule
									{#if hasCurrentConflicts}
										<span class="ml-auto text-xs">🔧 Auto-fix conflicts</span>
									{/if}
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
														<div
															class="h-1.5 w-1.5 rounded-full bg-green-200 dark:bg-green-400"
														></div>
														<span class="text-xs font-medium text-green-700 dark:text-green-300"
															>Allowed:</span
														>
													</div>
													<div class="flex flex-wrap gap-1">
														{#each rule.allowedTraitIds as traitId (traitId)}
															<Badge
																variant="default"
																class="border-green-200 text-xs text-green-800 dark:border-green-700 dark:text-green-200"
																>{getTraitName(traitId)}</Badge
															>
														{/each}
													</div>
												</div>
											{:else}
												<div class="rounded-md bg-green-50 p-2 dark:bg-green-950/20">
													<div class="flex items-center gap-2">
														<div
															class="h-1.5 w-1.5 rounded-full bg-green-200 dark:bg-green-400"
														></div>
														<span class="text-xs text-green-700 italic dark:text-green-300"
															>All traits allowed</span
														>
													</div>
												</div>
											{/if}

											{#if rule.forbiddenTraitIds.length > 0}
												<div class="rounded-md bg-red-50 p-2 dark:bg-red-950/20">
													<div class="mb-1 flex items-center gap-2">
														<div class="h-1.5 w-1.5 rounded-full bg-red-200 dark:bg-red-400"></div>
														<span class="text-xs font-medium text-red-700 dark:text-red-300"
															>Forbidden:</span
														>
													</div>
													<div class="flex flex-wrap gap-1">
														{#each rule.forbiddenTraitIds as traitId (traitId)}
															<Badge
																variant="destructive"
																class="border-red-200 text-xs dark:border-red-700"
																>{getTraitName(traitId)}</Badge
															>
														{/each}
													</div>
												</div>
											{:else}
												<div class="rounded-md bg-red-50 p-2 dark:bg-red-950/20">
													<div class="flex items-center gap-2">
														<div class="h-1.5 w-1.5 rounded-full bg-red-200 dark:bg-red-400"></div>
														<span class="text-xs text-red-700 italic dark:text-red-300"
															>No forbidden traits</span
														>
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
	</Modal>
{/if}
