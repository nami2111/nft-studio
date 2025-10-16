<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeft,
		FileText,
		Zap,
		Layers,
		Cpu,
		BarChart3,
		Github,
		Twitter,
		Crown
	} from 'lucide-svelte';

	let activeSection = 'overview';

	const sections = [
		{ id: 'overview', label: 'Overview', icon: FileText },
		{ id: 'quick-start', label: 'Quick Start', icon: Zap },
		{ id: 'advanced-features', label: 'Features', icon: Layers },
		{ id: 'ruler-traits', label: 'Ruler Traits', icon: Crown },
		{ id: 'technical-details', label: 'Technical', icon: Cpu },
		{ id: 'performance', label: 'Performance', icon: BarChart3 }
	];

	function showSection(sectionId: string) {
		activeSection = sectionId;
	}
</script>

<svelte:head>
	<title>About NFT Studio - Documentation</title>
	<meta
		name="description"
		content="NFT Studio: Professional web-based platform for creating generative NFT collections"
	/>
</svelte:head>

<div class="min-h-screen bg-white">
	<!-- Fixed Side Navigation -->
	<div class="fixed top-0 left-0 z-10 h-screen w-64 border-r border-gray-200 bg-white">
		<div class="p-6">
			<!-- Back Button -->
			<div class="mb-8">
				<Button
					variant="ghost"
					class="text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
					onclick={() => history.back()}
				>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
			</div>

			<!-- Logo/Title -->
			<div class="mb-8">
				<h1 class="text-xl font-bold text-gray-900">NFT Studio</h1>
				<p class="mt-1 text-sm text-gray-600">Documentation</p>
			</div>

			<!-- Navigation Menu -->
			<nav class="space-y-1">
				{#each sections as section (section.id)}
					<button
						class="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-left transition-colors {activeSection ===
						section.id
							? 'bg-gray-100 text-gray-900'
							: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
						onclick={() => showSection(section.id)}
					>
						<svelte:component this={section.icon} class="h-4 w-4" />
						<span class="text-sm font-medium">{section.label}</span>
					</button>
				{/each}
			</nav>

			<!-- Quick Actions -->
			<div class="mt-8 border-t border-gray-200 pt-8">
				<div class="space-y-2">
					<Button
						class="w-full bg-gray-900 text-white hover:bg-gray-800"
						onclick={() => (window.location.href = '/app')}
					>
						Launch Studio
					</Button>
					<Button
						variant="outline"
						class="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
						onclick={() => (window.location.href = '/')}
					>
						Homepage
					</Button>
				</div>
			</div>

			<!-- Social Links -->
			<div class="mt-8 border-t border-gray-200 pt-8">
				<div class="space-y-3">
					<p class="text-xs font-medium tracking-wider text-gray-500 uppercase">Connect</p>
					<div class="flex space-x-2">
						<a
							href="https://x.com/aimsomnia"
							target="_blank"
							rel="noopener noreferrer"
							class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
							title="Follow on X (Twitter)"
						>
							<Twitter class="h-4 w-4" />
						</a>
						<a
							href="https://github.com/nami2111"
							target="_blank"
							rel="noopener noreferrer"
							class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
							title="Follow on GitHub"
						>
							<Github class="h-4 w-4" />
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="ml-64">
		<div class="w-full px-8 py-12">
			<!-- Header Section -->
			<div class="mb-8">
				<div class="mb-6">
					<h1 class="mb-2 text-3xl font-bold text-gray-900">NFT Studio</h1>
					<p class="text-lg text-gray-600">
						Professional web-based platform for creating generative NFT collections with advanced
						layer management and high-performance generation.
					</p>
				</div>
			</div>

			<!-- Dynamic Content Section -->
			<div class="w-full">
				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Overview</h2>
							</div>
							<div class="px-6 py-6">
								<div class="prose max-w-none">
									<p class="mb-6 leading-relaxed text-gray-600">
										NFT Studio is a professional web application built with SvelteKit 2, TypeScript,
										and Web Workers. It provides artists and creators with a comprehensive toolkit
										for building generative NFT collections through an intuitive, high-performance
										interface.
									</p>

									<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
										<div>
											<h3 class="mb-3 font-semibold text-gray-900">Core Capabilities</h3>
											<ul class="space-y-2 text-sm text-gray-600">
												<li class="flex items-center">
													<div class="mr-3 h-1.5 w-1.5 rounded-full bg-gray-400"></div>
													Advanced layer management with bulk operations
												</li>
												<li class="flex items-center">
													<div class="mr-3 h-1.5 w-1.5 rounded-full bg-gray-400"></div>
													Web Worker-powered background processing
												</li>
												<li class="flex items-center">
													<div class="mr-3 h-1.5 w-1.5 rounded-full bg-gray-400"></div>
													Smart caching with LRU memory management
												</li>
												<li class="flex items-center">
													<div class="mr-3 h-1.5 w-1.5 rounded-full bg-gray-400"></div>
													Project persistence with ZIP import/export
												</li>
											</ul>
										</div>
										<div>
											<h3 class="mb-3 font-semibold text-gray-900">Technology Stack</h3>
											<div class="flex flex-wrap gap-2">
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>SvelteKit 2</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>TypeScript</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>Tailwind CSS</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>Web Workers</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>Canvas API</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>ICP Blockchain</span
												>
												<span
													class="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
													>Juno</span
												>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Quick Start Section -->
				{#if activeSection === 'quick-start'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Quick Start</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-6">
									<div>
										<h3 class="mb-4 font-semibold text-gray-900">5-Minute Setup</h3>
										<div class="space-y-4">
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													1
												</div>
												<div>
													<h4 class="font-medium text-gray-900">Launch Application</h4>
													<p class="text-sm text-gray-600">
														Click "Launch Studio" to enter the main workspace
													</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													2
												</div>
												<div>
													<h4 class="font-medium text-gray-900">Configure Project</h4>
													<p class="text-sm text-gray-600">
														Set collection name, size, and dimensions (recommended: 1024x1024)
													</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													3
												</div>
												<div>
													<h4 class="font-medium text-gray-900">Upload Artwork</h4>
													<p class="text-sm text-gray-600">
														Drag & drop PNG files into organized layers
													</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													4
												</div>
												<div>
													<h4 class="font-medium text-gray-900">Set Rarity</h4>
													<p class="text-sm text-gray-600">
														Adjust trait weights using the 1-5 rarity scale
													</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													5
												</div>
												<div>
													<h4 class="font-medium text-gray-900">Generate & Export</h4>
													<p class="text-sm text-gray-600">
														Click generate and download your complete collection
													</p>
												</div>
											</div>
										</div>
									</div>

									<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
										<div class="rounded-lg bg-gray-50 p-4">
											<h4 class="mb-2 font-medium text-gray-900">Requirements</h4>
											<ul class="space-y-1 text-sm text-gray-600">
												<li>• Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</li>
												<li>• 4GB+ RAM recommended for large collections</li>
												<li>• Modern JavaScript and Web Worker support</li>
											</ul>
										</div>
										<div class="rounded-lg bg-gray-50 p-4">
											<h4 class="mb-2 font-medium text-gray-900">File Guidelines</h4>
											<ul class="space-y-1 text-sm text-gray-600">
												<li>• PNG format recommended (supports transparency)</li>
												<li>• Consistent dimensions across all layers</li>
												<li>• Maximum 4096x4096 pixels per image</li>
											</ul>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Advanced Features Section -->
				{#if activeSection === 'advanced-features'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Features</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Layer System</h3>
										<div class="space-y-3">
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Drag & Drop Upload</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Bulk Trait Operations</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Smart Trait Filtering</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Layer Reordering</span>
											</div>
										</div>
									</div>

									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Performance</h3>
										<div class="space-y-3">
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Web Worker Processing</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">LRU Image Caching</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Adaptive Chunking</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-sm text-gray-700">Memory Management</span>
											</div>
										</div>
									</div>
								</div>

								<div class="mt-6 rounded-lg bg-gray-50 p-6">
									<h3 class="mb-3 font-semibold text-gray-900">Export Capabilities</h3>
									<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
										<div>
											<strong class="text-gray-800">Images:</strong>
											<p class="text-gray-600">PNG format with transparency</p>
										</div>
										<div>
											<strong class="text-gray-800">Metadata:</strong>
											<p class="text-gray-600">ERC-721/1155 compatible JSON</p>
										</div>
										<div>
											<strong class="text-gray-800">Preview:</strong>
											<p class="text-gray-600">HTML gallery with statistics</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Technical Details Section -->
				{#if activeSection === 'technical-details'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Technical Details</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
									<div>
										<h3 class="mb-3 font-semibold text-gray-900">Architecture</h3>
										<div class="space-y-2 text-sm text-gray-900">
											<p>
												<strong class="text-gray-900">Framework:</strong> SvelteKit 2 with Svelte 5
											</p>
											<p>
												<strong class="text-gray-900">Language:</strong> TypeScript with strict typing
											</p>
											<p><strong class="text-gray-900">Styling:</strong> Tailwind CSS 4</p>
											<p>
												<strong class="text-gray-900">State:</strong> Svelte 5 runes-based stores
											</p>
											<p><strong class="text-gray-900">Validation:</strong> Zod schemas</p>
										</div>
									</div>

									<div>
										<h3 class="mb-3 font-semibold text-gray-900">Processing</h3>
										<div class="space-y-2 text-sm text-gray-900">
											<p>
												<strong class="text-gray-900">Engine:</strong> Canvas API with Web Workers
											</p>
											<p><strong class="text-gray-900">Storage:</strong> IndexedDB + ZIP export</p>
											<p>
												<strong class="text-gray-900">Caching:</strong> LRU with ObjectURL management
											</p>
											<p><strong class="text-gray-900">Images:</strong> Up to 4096x4096px</p>
											<p>
												<strong class="text-gray-900">Formats:</strong> PNG, JPG, GIF, WebP, SVG
											</p>
										</div>
									</div>
								</div>

								<div class="mt-6 rounded-lg bg-gray-50 p-4">
									<h4 class="mb-2 font-semibold text-gray-900">
										Metadata Structure (ERC-721 Compatible)
									</h4>
									<pre class="overflow-x-auto rounded border bg-white p-3 text-xs text-gray-700">{`{
  "name": "Collection #1",
  "description": "Generated by NFT Studio",
  "image": "images/1.png",
  "edition": 1,
  "attributes": [
    {"trait_type": "Background", "value": "Blue"},
    {"trait_type": "Character", "value": "Robot"}
  ]
}`}</pre>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Performance Section -->
				{#if activeSection === 'performance'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Performance</h2>
							</div>
							<div class="px-6 py-6">
								<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
									<div class="text-center">
										<div class="mb-2 text-3xl font-bold text-gray-900">10,000</div>
										<p class="text-sm text-gray-600">Max Collection Size</p>
									</div>
									<div class="text-center">
										<div class="mb-2 text-3xl font-bold text-gray-900">~100/sec</div>
										<p class="text-sm text-gray-600">Generation Speed</p>
									</div>
									<div class="text-center">
										<div class="mb-2 text-3xl font-bold text-gray-900">2GB</div>
										<p class="text-sm text-gray-600">Peak Memory Usage</p>
									</div>
								</div>

								<div class="rounded-lg bg-gray-50 p-6">
									<h3 class="mb-3 font-semibold text-gray-900">Optimization Features</h3>
									<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
										<div>
											<strong class="text-gray-800">Background Processing:</strong>
											<p class="text-gray-600">Non-blocking UI with Web Workers</p>
										</div>
										<div>
											<strong class="text-gray-800">Smart Caching:</strong>
											<p class="text-gray-600">LRU cache with automatic cleanup</p>
										</div>
										<div>
											<strong class="text-gray-800">Memory Management:</strong>
											<p class="text-gray-600">Adaptive chunking for large collections</p>
										</div>
										<div>
											<strong class="text-gray-800">Progressive Loading:</strong>
											<p class="text-gray-600">Real-time preview during generation</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Ruler Traits Section -->
				{#if activeSection === 'ruler-traits'}
					<section class="animate-in fade-in duration-300">
						<div class="rounded-lg border border-gray-200 bg-white">
							<div class="border-b border-gray-200 px-6 py-4">
								<h2 class="text-xl font-semibold text-gray-900">Ruler Traits</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-8">
									<div>
										<h3 class="mb-4 font-semibold text-gray-900">What are Ruler Traits?</h3>
										<p class="mb-4 text-gray-600">
											Ruler traits are special traits that control which other traits can be
											combined together in your NFTs. They act as "rules" that enforce compatibility
											between different trait categories, allowing you to create more sophisticated
											and logical trait combinations.
										</p>
										<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
											<p class="text-sm text-blue-800">
												<strong>Example:</strong> A "Background" ruler trait might specify that "Forest"
												backgrounds only work with "Nature" themed traits, while "City" backgrounds work
												with "Urban" themed traits.
											</p>
										</div>
									</div>

									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Creating Ruler Traits</h3>
										<p class="mb-4 text-gray-600">
											Convert any existing trait into a ruler trait and configure its compatibility
											rules.
										</p>
										<ol class="ml-6 list-decimal space-y-2 text-gray-600">
											<li>Navigate to your project's trait layers</li>
											<li>Find the trait you want to make a ruler</li>
											<li>Click the ruler icon (👑) next to the trait name</li>
											<li>The trait will be marked as a ruler type (blue badge)</li>
											<li>Click "Manage Rules" to configure compatibility</li>
										</ol>
									</div>

									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Setting Up Compatibility Rules</h3>
										<p class="mb-4 text-gray-600">
											Configure which traits can work together with your ruler trait.
										</p>
										<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
											<h4 class="mb-2 font-semibold text-gray-900">Rule Configuration Steps:</h4>
											<ol class="ml-4 list-decimal space-y-1 text-sm text-gray-600">
												<li>Select the ruler trait you want to configure</li>
												<li>Choose a trait category from the dropdown</li>
												<li>Select specific traits that are compatible</li>
												<li>Add multiple rules for different categories</li>
												<li>Save your configuration</li>
											</ol>
										</div>
										<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
											<p class="text-sm text-amber-800">
												<strong>💡 Pro Tip:</strong> You can create multiple compatibility rules for
												the same ruler trait, covering different trait categories. This gives you fine-grained
												control over trait combinations.
											</p>
										</div>
									</div>

									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Use Cases</h3>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
												<h4 class="mb-2 font-semibold text-gray-900">Thematic Consistency</h4>
												<p class="text-sm text-gray-600">
													Ensure that traits match thematically (e.g., "Medieval" backgrounds only
													with "Fantasy" accessories).
												</p>
											</div>
											<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
												<h4 class="mb-2 font-semibold text-gray-900">Rarity Control</h4>
												<p class="text-sm text-gray-600">
													Create ultra-rare combinations by restricting certain traits to only work
													with specific rulers.
												</p>
											</div>
											<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
												<h4 class="mb-2 font-semibold text-gray-900">Storytelling</h4>
												<p class="text-sm text-gray-600">
													Build narrative logic where certain character backgrounds determine
													available traits.
												</p>
											</div>
											<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
												<h4 class="mb-2 font-semibold text-gray-900">Collection Structure</h4>
												<p class="text-sm text-gray-600">
													Create sub-collections within your main collection based on ruler trait
													combinations.
												</p>
											</div>
										</div>
									</div>

									<div>
										<h3 class="mb-4 font-semibold text-gray-900">Best Practices</h3>
										<ul class="ml-6 list-disc space-y-2 text-gray-600">
											<li>
												<strong>Plan Ahead:</strong> Design your ruler system before importing large
												numbers of traits
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
										<h3 class="mb-4 font-semibold text-gray-900">Visual Indicators</h3>
										<p class="mb-4 text-gray-600">
											The UI provides clear visual cues for ruler traits and their status:
										</p>
										<div class="space-y-2">
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">👑</span>
												<span class="text-gray-600"
													>Ruler icon - indicates a trait is a ruler type</span
												>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-blue-200 bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
													>RULER</span
												>
												<span class="text-gray-600">Blue badge - ruler trait type indicator</span>
											</div>
											<div class="flex items-center space-x-3">
												<span
													class="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800"
													>NORMAL</span
												>
												<span class="text-gray-600">Gray badge - normal trait type</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
				{/if}
			</div>
		</div>
	</div>
</div>
