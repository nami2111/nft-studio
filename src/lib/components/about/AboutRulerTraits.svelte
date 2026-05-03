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
											<li>Click the crown icon (👑) in the top-right corner of the trait card</li>
											<li>The trait is converted to ruler type (crown icon becomes highlighted)</li>
											<li>
												Click the settings (⚙️) icon that appears next to ruler traits to manage
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
												<li>Click the settings (⚙️) icon on your ruler trait</li>
												<li>Select a target layer from the dropdown menu</li>
												<li>Click traits to mark them as allowed (green badges)</li>
												<li>Click traits to mark them as forbidden (red badges)</li>
												<li>Click "Add Rule" to save your configuration</li>
											</ol>
										</div>
										<div class="border-border bg-muted rounded-lg border p-4">
											<p class="text-foreground text-sm">
												<strong>💡 Pro Tip:</strong> You can create multiple compatibility rules for the
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
										</ul>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Visual Indicators</h3>
										<p class="text-muted-foreground mb-4">
											The UI provides clear visual cues for ruler traits and their status:
										</p>
										<div class="space-y-2">
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">👑</span>
												<span class="text-muted-foreground"
													>Crown icon - click to toggle trait between normal and ruler type</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">⚙️</span>
												<span class="text-muted-foreground"
													>Settings icon - appears only for ruler traits, click to manage
													compatibility rules</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-green-600 bg-green-600 px-2 py-1 text-xs font-medium text-white"
												>
													✓ Trait</span
												>
												<span class="text-muted-foreground"
													>Green badge - allowed traits in rule configuration</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs font-medium text-white"
												>
													✗ Trait</span
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
