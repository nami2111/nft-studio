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
		Crown,
		Menu,
		X
	} from 'lucide-svelte';

	let activeSection = 'overview';
	let isMobileMenuOpen = false;

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
		isMobileMenuOpen = false; // Close mobile menu after selection
	}

	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}
</script>

<svelte:head>
	<title>About NFT Studio - Documentation</title>
	<meta
		name="description"
		content="NFT Studio: Professional web-based platform for creating generative NFT collections"
	/>
</svelte:head>

<div class="bg-background min-h-screen">
	<!-- Mobile Header -->
	<div class="border-border bg-card sticky top-0 z-20 border-b sm:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center space-x-3">
				<Button
					variant="ghost"
					size="icon"
					class="text-muted-foreground hover:text-foreground"
					onclick={toggleMobileMenu}
				>
					<Menu class="h-5 w-5" />
				</Button>
				<div>
					<h1 class="text-foreground text-lg font-bold">NFT Studio</h1>
					<p class="text-muted-foreground text-xs">Documentation</p>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="text-muted-foreground hover:text-foreground"
				onclick={() => history.back()}
			>
				<ArrowLeft class="h-5 w-5" />
			</Button>
		</div>
	</div>

	<!-- Mobile Navigation Overlay -->
	{#if isMobileMenuOpen}
		<div class="fixed inset-0 z-30 sm:hidden">
			<div
				class="fixed inset-0 bg-black/50"
				role="button"
				tabindex="0"
				aria-label="Close mobile menu"
				onclick={closeMobileMenu}
				onkeydown={(e) => e.key === 'Enter' && closeMobileMenu()}
			></div>
			<div
				class="border-border bg-card fixed top-0 left-0 h-full w-80 border-r bg-white shadow-xl backdrop-blur-sm dark:bg-gray-900"
			>
				<div class="p-4">
					<div class="mb-6 flex items-center justify-between">
						<div>
							<h1 class="text-foreground text-lg font-bold">NFT Studio</h1>
							<p class="text-muted-foreground text-xs">Documentation</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:text-foreground"
							onclick={closeMobileMenu}
						>
							<X class="h-5 w-5" />
						</Button>
					</div>

					<!-- Navigation Menu -->
					<nav class="space-y-1">
						{#each sections as section (section.id)}
							<button
								class="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-left transition-all duration-200 {activeSection ===
								section.id
									? 'bg-primary text-primary-foreground scale-[1.02] shadow-sm'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01]'}"
								onclick={() => showSection(section.id)}
							>
								<svelte:component this={section.icon} class="h-4 w-4" />
								<span class="text-sm font-medium">{section.label}</span>
							</button>
						{/each}
					</nav>

					<!-- Quick Actions -->
					<div class="border-border mt-6 border-t pt-6">
						<div class="space-y-2">
							<Button
								variant="outline"
								size="sm"
								class="w-full"
								onclick={() => (window.location.href = '/app')}
							>
								Launch Studio
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="w-full"
								onclick={() => (window.location.href = '/')}
							>
								Homepage
							</Button>
						</div>
					</div>

					<!-- Social Links -->
					<div class="border-border mt-6 border-t pt-6">
						<div class="space-y-3">
							<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
								Connect
							</p>
							<div class="flex space-x-2">
								<a
									href="https://x.com/aimsomnia"
									target="_blank"
									rel="noopener noreferrer"
									class="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
									title="Follow on X (Twitter)"
								>
									<Twitter class="h-4 w-4" />
								</a>
								<a
									href="https://github.com/nami2111"
									target="_blank"
									rel="noopener noreferrer"
									class="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
									title="Follow on GitHub"
								>
									<Github class="h-4 w-4" />
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Desktop Side Navigation -->
	<div
		class="border-border bg-card fixed top-0 left-0 z-10 hidden h-screen w-64 border-r bg-white sm:block dark:bg-gray-900"
	>
		<div class="p-6">
			<!-- Back Button -->
			<div class="mb-8">
				<Button
					variant="ghost"
					class="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					onclick={() => history.back()}
				>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
			</div>

			<!-- Logo/Title -->
			<div class="mb-8">
				<h1 class="text-foreground text-xl font-bold">NFT Studio</h1>
				<p class="text-muted-foreground mt-1 text-sm">Documentation</p>
			</div>

			<!-- Navigation Menu -->
			<nav class="space-y-1">
				{#each sections as section (section.id)}
					<button
						class="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-left transition-all duration-200 {activeSection ===
						section.id
							? 'bg-primary text-primary-foreground scale-[1.02] shadow-sm'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01]'}"
						onclick={() => showSection(section.id)}
					>
						<svelte:component this={section.icon} class="h-4 w-4" />
						<span class="text-sm font-medium">{section.label}</span>
					</button>
				{/each}
			</nav>

			<!-- Quick Actions -->
			<div class="border-border mt-8 border-t pt-8">
				<div class="space-y-2">
					<Button
						variant="outline"
						size="lg"
						class="w-full transition-all hover:scale-105 hover:shadow-lg"
						onclick={() => (window.location.href = '/app')}
					>
						Launch Studio
					</Button>
					<Button
						variant="outline"
						size="lg"
						class="w-full transition-all hover:scale-105 hover:shadow-lg"
						onclick={() => (window.location.href = '/')}
					>
						Homepage
					</Button>
				</div>
			</div>

			<!-- Social Links -->
			<div class="border-border mt-8 border-t pt-8">
				<div class="space-y-3">
					<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">Connect</p>
					<div class="flex space-x-2">
						<a
							href="https://x.com/aimsomnia"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
							title="Follow on X (Twitter)"
						>
							<Twitter class="h-4 w-4" />
						</a>
						<a
							href="https://github.com/nami2111"
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
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
	<div class="sm:ml-64">
		<div class="w-full px-4 py-6 sm:px-8 sm:py-12">
			<!-- Header Section -->
			<div class="mb-6 sm:mb-8">
				<div class="mb-4 sm:mb-6">
					<h1 class="text-foreground mb-2 text-2xl font-bold sm:text-3xl">NFT Studio</h1>
					<p class="text-muted-foreground text-base sm:text-lg">
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
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-4 py-3 sm:px-6 sm:py-4">
								<h2 class="text-foreground text-lg font-semibold sm:text-xl">Overview</h2>
							</div>
							<div class="px-4 py-4 sm:px-6 sm:py-6">
								<div class="prose max-w-none">
									<p class="text-muted-foreground mb-6 leading-relaxed">
										NFT Studio is a professional web application built with SvelteKit 2, TypeScript,
										and Web Workers. It provides artists and creators with a comprehensive toolkit
										for building generative NFT collections through an intuitive, high-performance
										interface.
									</p>

									<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
										<div>
											<h3 class="text-foreground mb-3 font-semibold">Core Capabilities</h3>
											<ul class="text-muted-foreground space-y-2 text-sm">
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
											<h3 class="text-foreground mb-3 font-semibold">Technology Stack</h3>
											<div class="flex flex-wrap gap-2">
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>SvelteKit 2</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>TypeScript</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>Tailwind CSS</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>Web Workers</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>Canvas API</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
													>ICP Blockchain</span
												>
												<span
													class="text-foreground rounded bg-gray-100 px-3 py-1 text-xs font-medium"
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
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Quick Start</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-6">
									<div>
										<h3 class="text-foreground mb-4 font-semibold">5-Minute Setup</h3>
										<div class="space-y-4">
											<div class="flex items-start space-x-4">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
												>
													1
												</div>
												<div>
													<h4 class="text-foreground font-medium">Launch Application</h4>
													<p class="text-muted-foreground text-sm">
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
													<h4 class="text-foreground font-medium">Configure Project</h4>
													<p class="text-muted-foreground text-sm">
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
													<h4 class="text-foreground font-medium">Upload Artwork</h4>
													<p class="text-muted-foreground text-sm">
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
													<h4 class="text-foreground font-medium">Set Rarity</h4>
													<p class="text-muted-foreground text-sm">
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
													<h4 class="text-foreground font-medium">Generate & Export</h4>
													<p class="text-muted-foreground text-sm">
														Click generate and download your complete collection
													</p>
												</div>
											</div>
										</div>
									</div>

									<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
										<div class="bg-muted rounded-lg p-4">
											<h4 class="text-foreground mb-2 font-medium">Requirements</h4>
											<ul class="text-muted-foreground space-y-1 text-sm">
												<li>• Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</li>
												<li>• 4GB+ RAM recommended for large collections</li>
												<li>• Modern JavaScript and Web Worker support</li>
											</ul>
										</div>
										<div class="bg-muted rounded-lg p-4">
											<h4 class="text-foreground mb-2 font-medium">File Guidelines</h4>
											<ul class="text-muted-foreground space-y-1 text-sm">
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
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Features</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
									<div>
										<h3 class="text-foreground mb-4 font-semibold">Layer System</h3>
										<div class="space-y-3">
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Drag & Drop Upload</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Bulk Trait Operations</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Smart Trait Filtering</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Layer Reordering</span>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Performance</h3>
										<div class="space-y-3">
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Web Worker Processing</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">LRU Image Caching</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Adaptive Chunking</span>
											</div>
											<div class="flex items-center space-x-3">
												<div class="h-2 w-2 rounded-full bg-gray-600"></div>
												<span class="text-foreground text-sm">Memory Management</span>
											</div>
										</div>
									</div>
								</div>

								<div class="bg-muted mt-6 rounded-lg p-6">
									<h3 class="text-foreground mb-3 font-semibold">Export Capabilities</h3>
									<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
										<div>
											<strong class="text-foreground">Images:</strong>
											<p class="text-muted-foreground">PNG format with transparency</p>
										</div>
										<div>
											<strong class="text-foreground">Metadata:</strong>
											<p class="text-muted-foreground">ERC-721/1155 compatible JSON</p>
										</div>
										<div>
											<strong class="text-foreground">Preview:</strong>
											<p class="text-muted-foreground">HTML gallery with statistics</p>
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
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Technical Details</h2>
							</div>
							<div class="px-6 py-6">
								<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
									<div>
										<h3 class="text-foreground mb-3 font-semibold">Architecture</h3>
										<div class="text-foreground space-y-2 text-sm">
											<p>
												<strong class="text-foreground">Framework:</strong> SvelteKit 2 with Svelte 5
											</p>
											<p>
												<strong class="text-foreground">Language:</strong> TypeScript with strict typing
											</p>
											<p><strong class="text-foreground">Styling:</strong> Tailwind CSS 4</p>
											<p>
												<strong class="text-foreground">State:</strong> Svelte 5 runes-based stores
											</p>
											<p><strong class="text-foreground">Validation:</strong> Zod schemas</p>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-3 font-semibold">Processing</h3>
										<div class="text-foreground space-y-2 text-sm">
											<p>
												<strong class="text-foreground">Engine:</strong> Canvas API with Web Workers
											</p>
											<p>
												<strong class="text-foreground">Storage:</strong> IndexedDB + ZIP export
											</p>
											<p>
												<strong class="text-foreground">Caching:</strong> LRU with ObjectURL management
											</p>
											<p><strong class="text-foreground">Images:</strong> Up to 4096x4096px</p>
											<p>
												<strong class="text-foreground">Formats:</strong> PNG, JPG, GIF, WebP, SVG
											</p>
										</div>
									</div>
								</div>

								<div class="bg-muted mt-6 rounded-lg p-4">
									<h4 class="text-foreground mb-2 font-semibold">
										Metadata Structure (ERC-721 Compatible)
									</h4>
									<pre
										class="bg-card text-foreground overflow-x-auto rounded border p-3 text-xs">{`{
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
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Performance</h2>
							</div>
							<div class="px-6 py-6">
								<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">10,000</div>
										<p class="text-muted-foreground text-sm">Max Collection Size</p>
									</div>
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">~100/sec</div>
										<p class="text-muted-foreground text-sm">Generation Speed</p>
									</div>
									<div class="text-center">
										<div class="text-foreground mb-2 text-3xl font-bold">2GB</div>
										<p class="text-muted-foreground text-sm">Peak Memory Usage</p>
									</div>
								</div>

								<div class="bg-muted rounded-lg p-6">
									<h3 class="text-foreground mb-3 font-semibold">Optimization Features</h3>
									<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
										<div>
											<strong class="text-foreground">Background Processing:</strong>
											<p class="text-muted-foreground">Non-blocking UI with Web Workers</p>
										</div>
										<div>
											<strong class="text-foreground">Smart Caching:</strong>
											<p class="text-muted-foreground">LRU cache with automatic cleanup</p>
										</div>
										<div>
											<strong class="text-foreground">Memory Management:</strong>
											<p class="text-muted-foreground">Adaptive chunking for large collections</p>
										</div>
										<div>
											<strong class="text-foreground">Progressive Loading:</strong>
											<p class="text-muted-foreground">Real-time preview during generation</p>
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
											combined together in your NFTs. They act as "rules" that enforce compatibility
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
												<strong>💡 Pro Tip:</strong> You can create multiple compatibility rules for
												the same ruler trait, covering different trait categories. This gives you fine-grained
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
				{/if}
			</div>
		</div>
	</div>
</div>
