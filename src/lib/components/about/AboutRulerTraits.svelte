<script lang="ts">
	import Icon from '$components/shared/Icon.svelte';
	import { Crown03Icon, Setting07Icon, IdeaIcon, CheckmarkBadge01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
</script>

<section class="animate-in fade-in duration-300">
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Ruler Traits</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-8">
									<div>
										<h3 class="text-foreground mb-4 font-semibold">What are Ruler Traits?</h3>
										<p class="text-muted-foreground mb-4">
											Ruler traits are special traits that control which other traits can be
											combined together in your items. They act as "rules" that enforce compatibility
											between different trait categories, allowing you to create more sophisticated
											and logical trait combinations.
										</p>
										<div class="border-border bg-muted rounded-lg border p-4">
											<p class="text-foreground text-sm">
												<strong>Example:</strong> A "Background" ruler trait might specify that "Forest"
												backgrounds only work with "Nature" themed traits, while "City" backgrounds work
												with "Urban" themed traits.
											</p>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Creating Ruler Traits</h3>
										<p class="text-muted-foreground mb-4">
											Convert any existing trait into a ruler trait and configure its compatibility
											rules.
										</p>
										<ol class="text-muted-foreground ml-6 list-decimal space-y-2">
											<li>Navigate to your project's trait layers</li>
											<li>Find the trait you want to make a ruler</li>
											<li>Click the crown icon (<Icon icon={Crown03Icon} class="inline h-4 w-4" />) in the top-right corner of the trait card</li>
											<li>The trait is converted to ruler type (crown icon becomes highlighted)</li>
											<li>
												Click the settings (<Icon icon={Setting07Icon} class="inline h-4 w-4" />) icon that appears next to ruler traits to manage
												rules
											</li>
										</ol>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">
											Setting Up Compatibility Rules
										</h3>
										<p class="text-muted-foreground mb-4">
											Configure which traits can work together with your ruler trait.
										</p>
										<div class="border-border bg-muted mb-4 rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">Rule Configuration Steps:</h4>
											<ol class="text-muted-foreground ml-4 list-decimal space-y-1 text-sm">
												<li>Click the settings (<Icon icon={Setting07Icon} class="inline h-4 w-4" />) icon on your ruler trait</li>
												<li>Select a target layer from the dropdown menu</li>
												<li>Click traits to mark them as allowed (green badges)</li>
												<li>Click traits to mark them as forbidden (red badges)</li>
												<li>Click "Add Rule" to save your configuration</li>
											</ol>
										</div>
										<div class="border-border bg-muted rounded-lg border p-4">
											<p class="text-foreground text-sm flex items-start gap-1">
												<Icon icon={IdeaIcon} class="mt-0.5 h-4 w-4 shrink-0" /> <strong>Pro Tip:</strong> You can create multiple compatibility rules for the
												same ruler trait, covering different trait categories. This gives you fine-grained
												control over trait combinations.
											</p>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Use Cases</h3>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Thematic Consistency</h4>
												<p class="text-muted-foreground text-sm">
													Ensure that traits match thematically (e.g., "Medieval" backgrounds only
													with "Fantasy" accessories).
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Rarity Control</h4>
												<p class="text-muted-foreground text-sm">
													Create ultra-rare combinations by restricting certain traits to only work
													with specific rulers.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Storytelling</h4>
												<p class="text-muted-foreground text-sm">
													Build narrative logic where certain character backgrounds determine
													available traits.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Collection Structure</h4>
												<p class="text-muted-foreground text-sm">
													Create sub-collections within your main collection based on ruler trait
													combinations.
												</p>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Best Practices</h3>
										<ul class="text-muted-foreground ml-6 list-disc space-y-2">
											<li>
												<strong>Plan Ahead:</strong> Design your ruler system before importing large numbers
												of traits
											</li>
											<li>
												<strong>Test Combinations:</strong> Use the preview feature to verify compatibility
												rules work as expected
											</li>
											<li>
												<strong>Document Rules:</strong> Keep track of your ruler logic for future reference
											</li>
											<li>
												<strong>Start Simple:</strong> Begin with basic ruler rules and gradually add
												complexity
											</li>
										<li>
											<strong>Validate Generation:</strong> Always run a small test generation before
											creating large collections
										</li>
										<li>
											<strong>Check Preview Results:</strong> Use previews and small generations to verify that rules produce the combinations you expect
										</li>
										<li>
											<strong>Monitor Rules:</strong> AC-3 pruning runs once per generation, not per item, for efficient validation
										</li>
									</ul>
									</div>

								<div>
									<h3 class="text-foreground mb-4 font-semibold">Under the Hood: CSP Integration</h3>
									<p class="text-muted-foreground mb-4">
										Ruler trait compatibility rules are enforced by the CSP (Constraint Satisfaction Problem) solver during generation:
									</p>
									<div class="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
										<div class="border-border bg-muted rounded-lg border p-3">
											<h4 class="text-foreground mb-1 text-sm font-semibold">AC-3 Arc Consistency</h4>
											<p class="text-muted-foreground text-xs">Prunes incompatible trait domains before selection, achieving 60-80% search space reduction.</p>
										</div>
										<div class="border-border bg-muted rounded-lg border p-3">
											<h4 class="text-foreground mb-1 text-sm font-semibold">Constraint Caching</h4>
											<p class="text-muted-foreground text-xs">ConstraintCache with hit-rate tracking avoids redundant compatibility checks.</p>
										</div>
										<div class="border-border bg-muted rounded-lg border p-3">
											<h4 class="text-foreground mb-1 text-sm font-semibold">Validation Functions</h4>
											<p class="text-muted-foreground text-xs"><code>validateTraitCompatibility()</code> and <code>getCompatibleTraits()</code> for pair and set validation.</p>
										</div>
										<div class="border-border bg-muted rounded-lg border p-3">
											<h4 class="text-foreground mb-1 text-sm font-semibold">Cross-Layer Enforcement</h4>
											<p class="text-muted-foreground text-xs">Rules from one layer instantly constrain available traits in all other layers.</p>
										</div>
									</div>
								</div>

								<div>
									<h3 class="text-foreground mb-4 font-semibold">Visual Indicators</h3>
										<p class="text-muted-foreground mb-4">
											The UI provides clear visual cues for ruler traits and their status:
										</p>
										<div class="space-y-2">
											<div class="flex items-center space-x-3">
												<span class="text-blue-500"><Icon icon={Crown03Icon} class="h-5 w-5" /></span>
												<span class="text-muted-foreground"
													>Crown icon - click to toggle trait between normal and ruler type</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span class="text-blue-500"><Icon icon={Setting07Icon} class="h-5 w-5" /></span>
												<span class="text-muted-foreground"
													>Settings icon - appears only for ruler traits, click to manage
													compatibility rules</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-green-600 bg-green-600 px-2 py-1 text-xs font-medium text-white flex items-center gap-1"
												>
													<Icon icon={CheckmarkBadge01Icon} class="h-3 w-3" /> Trait</span
												>
												<span class="text-muted-foreground"
													>Green badge - allowed traits in rule configuration</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs font-medium text-white flex items-center gap-1"
												>
													<Icon icon={Cancel01Icon} class="h-3 w-3" /> Trait</span
												>
												<span class="text-muted-foreground"
													>Red badge - forbidden traits in rule configuration</span
												>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
