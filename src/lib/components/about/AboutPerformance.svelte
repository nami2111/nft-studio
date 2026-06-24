<script lang="ts">
</script>

					<section class="animate-in fade-in duration-300">
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Performance</h2>
							</div>
							<div class="px-6 py-6">
								<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">10,000</div>
										<p class="text-muted-foreground text-sm">Max Collection Size</p>
									</div>
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">~8</div>
										<p class="text-muted-foreground text-sm">Max Web Workers</p>
									</div>
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">3</div>
										<p class="text-muted-foreground text-sm">Cache Tiers</p>
									</div>
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">60-80%</div>
										<p class="text-muted-foreground text-sm">Search Space Reduction</p>
									</div>
								</div>

								<div class="bg-muted rounded-lg p-6">
									<h3 class="text-foreground mb-3 font-semibold">Optimization Features</h3>
									<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
										<div>
											<strong class="text-foreground">CSP Solver:</strong>
											<p class="text-muted-foreground">AC-3 arc consistency prunes 60-80% of search space. MRV heuristic reduces backtracking depth.</p>
										</div>
										<div>
											<strong class="text-foreground">Three-Tier Caching:</strong>
											<p class="text-muted-foreground">ImageBitmap (100MB/500 entries), ImageData (50MB/200), ArrayBuffer (200MB/1000) with LRU eviction.</p>
										</div>
										<div>
											<strong class="text-foreground">Memory Pressure:</strong>
											<p class="text-muted-foreground">Automatic cleanup at 200MB (light), 500MB (moderate), 800MB (high) thresholds.</p>
										</div>
										<div>
											<strong class="text-foreground">Worker Pool:</strong>
											<p class="text-muted-foreground">Device-aware dynamic scaling with health monitoring, work stealing, and auto-restart.</p>
										</div>
										<div>
											<strong class="text-foreground">Streaming Storage:</strong>
											<p class="text-muted-foreground">Items stream to browser storage during generation, reducing peak memory by 60-80%.</p>
										</div>
										<div>
											<strong class="text-foreground">ZIP Export:</strong>
											<p class="text-muted-foreground">Standard, chunked, and multi-ZIP (1GB splits) with dedicated worker offloading.</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
