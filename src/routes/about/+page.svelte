<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, FileText, Zap, Layers, Cpu, BarChart3, Github, Twitter } from 'lucide-svelte';

	let activeSection = 'overview';

	const sections = [
		{ id: 'overview', label: 'Overview', icon: FileText },
		{ id: 'quick-start', label: 'Quick Start', icon: Zap },
		{ id: 'advanced-features', label: 'Features', icon: Layers },
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
	<div class="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 z-10">
		<div class="p-6">
			<!-- Back Button -->
			<div class="mb-8">
				<Button
					variant="ghost"
					class="text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
					onclick={() => history.back()}
				>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
			</div>

			<!-- Logo/Title -->
			<div class="mb-8">
				<h1 class="text-xl font-bold text-gray-900">NFT Studio</h1>
				<p class="text-sm text-gray-600 mt-1">Documentation</p>
			</div>

			<!-- Navigation Menu -->
			<nav class="space-y-1">
				{#each sections as section}
					<button
						class="w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors {
							activeSection === section.id
								? 'bg-gray-100 text-gray-900'
								: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
						}"
						onclick={() => showSection(section.id)}
					>
						<svelte:component this={section.icon} class="h-4 w-4" />
						<span class="text-sm font-medium">{section.label}</span>
					</button>
				{/each}
			</nav>

			<!-- Quick Actions -->
			<div class="mt-8 pt-8 border-t border-gray-200">
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
			<div class="mt-8 pt-8 border-t border-gray-200">
				<div class="space-y-3">
					<p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Connect</p>
					<div class="flex space-x-2">
						<a 
							href="https://x.com/aimsomnia" 
							target="_blank" 
							rel="noopener noreferrer"
							class="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
							title="Follow on X (Twitter)"
						>
							<Twitter class="h-4 w-4" />
						</a>
						<a 
							href="https://github.com/nami2111" 
							target="_blank" 
							rel="noopener noreferrer"
							class="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
		<div class="px-8 py-12 w-full">
			<!-- Header Section -->
			<div class="mb-8">
				<div class="mb-6">
					<h1 class="text-3xl font-bold text-gray-900 mb-2">NFT Studio</h1>
					<p class="text-lg text-gray-600">
						Professional web-based platform for creating generative NFT collections with advanced layer management and high-performance generation.
					</p>
				</div>
			</div>

			<!-- Dynamic Content Section -->
			<div class="w-full">
				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<section class="animate-in fade-in duration-300">
						<div class="bg-white border border-gray-200 rounded-lg">
							<div class="px-6 py-4 border-b border-gray-200">
								<h2 class="text-xl font-semibold text-gray-900">Overview</h2>
							</div>
							<div class="px-6 py-6">
								<div class="prose max-w-none">
									<p class="text-gray-600 leading-relaxed mb-6">
										NFT Studio is a professional web application built with SvelteKit 2, TypeScript, and Web Workers. 
										It provides artists and creators with a comprehensive toolkit for building generative NFT collections 
										through an intuitive, high-performance interface.
									</p>
									
									<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
										<div>
											<h3 class="font-semibold text-gray-900 mb-3">Core Capabilities</h3>
											<ul class="space-y-2 text-sm text-gray-600">
												<li class="flex items-center">
													<div class="h-1.5 w-1.5 rounded-full bg-gray-400 mr-3"></div>
													Advanced layer management with bulk operations
												</li>
												<li class="flex items-center">
													<div class="h-1.5 w-1.5 rounded-full bg-gray-400 mr-3"></div>
													Web Worker-powered background processing
												</li>
												<li class="flex items-center">
													<div class="h-1.5 w-1.5 rounded-full bg-gray-400 mr-3"></div>
													Smart caching with LRU memory management
												</li>
												<li class="flex items-center">
													<div class="h-1.5 w-1.5 rounded-full bg-gray-400 mr-3"></div>
													Project persistence with ZIP import/export
												</li>
											</ul>
										</div>
										<div>
											<h3 class="font-semibold text-gray-900 mb-3">Technology Stack</h3>
											<div class="flex flex-wrap gap-2">
												<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">SvelteKit 2</span>
												<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">TypeScript</span>
												<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Tailwind CSS</span>
												<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Web Workers</span>
												<span class="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Canvas API</span>
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
						<div class="bg-white border border-gray-200 rounded-lg">
							<div class="px-6 py-4 border-b border-gray-200">
								<h2 class="text-xl font-semibold text-gray-900">Quick Start</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-6">
									<div>
										<h3 class="font-semibold text-gray-900 mb-4">5-Minute Setup</h3>
										<div class="space-y-4">
											<div class="flex items-start space-x-4">
												<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">1</div>
												<div>
													<h4 class="font-medium text-gray-900">Launch Application</h4>
													<p class="text-sm text-gray-600">Click "Launch Studio" to enter the main workspace</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">2</div>
												<div>
													<h4 class="font-medium text-gray-900">Configure Project</h4>
													<p class="text-sm text-gray-600">Set collection name, size, and dimensions (recommended: 1024x1024)</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">3</div>
												<div>
													<h4 class="font-medium text-gray-900">Upload Artwork</h4>
													<p class="text-sm text-gray-600">Drag & drop PNG files into organized layers</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">4</div>
												<div>
													<h4 class="font-medium text-gray-900">Set Rarity</h4>
													<p class="text-sm text-gray-600">Adjust trait weights using the 1-5 rarity scale</p>
												</div>
											</div>
											<div class="flex items-start space-x-4">
												<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-semibold">5</div>
												<div>
													<h4 class="font-medium text-gray-900">Generate & Export</h4>
													<p class="text-sm text-gray-600">Click generate and download your complete collection</p>
												</div>
											</div>
										</div>
									</div>

									<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div class="bg-gray-50 p-4 rounded-lg">
											<h4 class="font-medium text-gray-900 mb-2">Requirements</h4>
											<ul class="text-sm text-gray-600 space-y-1">
												<li>• Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</li>
												<li>• 4GB+ RAM recommended for large collections</li>
												<li>• Modern JavaScript and Web Worker support</li>
											</ul>
										</div>
										<div class="bg-gray-50 p-4 rounded-lg">
											<h4 class="font-medium text-gray-900 mb-2">File Guidelines</h4>
											<ul class="text-sm text-gray-600 space-y-1">
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
						<div class="bg-white border border-gray-200 rounded-lg">
							<div class="px-6 py-4 border-b border-gray-200">
								<h2 class="text-xl font-semibold text-gray-900">Features</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
									<div>
										<h3 class="font-semibold text-gray-900 mb-4">Layer System</h3>
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
										<h3 class="font-semibold text-gray-900 mb-4">Performance</h3>
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

								<div class="mt-6 bg-gray-50 p-6 rounded-lg">
									<h3 class="font-semibold text-gray-900 mb-3">Export Capabilities</h3>
									<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
						<div class="bg-white border border-gray-200 rounded-lg">
							<div class="px-6 py-4 border-b border-gray-200">
								<h2 class="text-xl font-semibold text-gray-900">Technical Details</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<h3 class="font-semibold text-gray-900 mb-3">Architecture</h3>
										<div class="space-y-2 text-sm text-gray-900">
											<p><strong class="text-gray-900">Framework:</strong> SvelteKit 2 with Svelte 5</p>
											<p><strong class="text-gray-900">Language:</strong> TypeScript with strict typing</p>
											<p><strong class="text-gray-900">Styling:</strong> Tailwind CSS 4</p>
											<p><strong class="text-gray-900">State:</strong> Svelte 5 runes-based stores</p>
											<p><strong class="text-gray-900">Validation:</strong> Zod schemas</p>
										</div>
									</div>

									<div>
										<h3 class="font-semibold text-gray-900 mb-3">Processing</h3>
										<div class="space-y-2 text-sm text-gray-900">
											<p><strong class="text-gray-900">Engine:</strong> Canvas API with Web Workers</p>
											<p><strong class="text-gray-900">Storage:</strong> IndexedDB + ZIP export</p>
											<p><strong class="text-gray-900">Caching:</strong> LRU with ObjectURL management</p>
											<p><strong class="text-gray-900">Images:</strong> Up to 4096x4096px</p>
											<p><strong class="text-gray-900">Formats:</strong> PNG, JPG, GIF, WebP, SVG</p>
										</div>
									</div>
								</div>

								<div class="mt-6 bg-gray-50 p-4 rounded-lg">
									<h4 class="font-semibold text-gray-900 mb-2">Metadata Structure (ERC-721 Compatible)</h4>
									<pre class="text-xs bg-white p-3 rounded border text-gray-700 overflow-x-auto">{`{
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
						<div class="bg-white border border-gray-200 rounded-lg">
							<div class="px-6 py-4 border-b border-gray-200">
								<h2 class="text-xl font-semibold text-gray-900">Performance</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
									<div class="text-center">
										<div class="text-3xl font-bold text-gray-900 mb-2">10,000</div>
										<p class="text-sm text-gray-600">Max Collection Size</p>
									</div>
									<div class="text-center">
										<div class="text-3xl font-bold text-gray-900 mb-2">~100/sec</div>
										<p class="text-sm text-gray-600">Generation Speed</p>
									</div>
									<div class="text-center">
										<div class="text-3xl font-bold text-gray-900 mb-2">2GB</div>
										<p class="text-sm text-gray-600">Peak Memory Usage</p>
									</div>
								</div>

								<div class="bg-gray-50 p-6 rounded-lg">
									<h3 class="font-semibold text-gray-900 mb-3">Optimization Features</h3>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

				
			</div>
		</div>
	</div>
</div>
