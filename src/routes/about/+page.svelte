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
		X,
		Image,
		Settings
	} from 'lucide-svelte';

	let activeSection = 'overview';
	let isMobileMenuOpen = false;

	const sections = [
		{ id: 'overview', label: 'Overview', icon: FileText },
		{ id: 'quick-start', label: 'Quick Start', icon: Zap },
		{ id: 'advanced-features', label: 'Features', icon: Layers },
		{ id: 'gallery-mode', label: 'Gallery Mode', icon: Image },
		{ id: 'strict-pair', label: 'Strict Pair', icon: Settings },
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

				<!-- Gallery Mode Section -->
				{#if activeSection === 'gallery-mode'}
					<section class="animate-in fade-in duration-300">
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Gallery Mode</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-8">
									<div>
										<h3 class="text-foreground mb-4 font-semibold">View & Manage Collections</h3>
										<p class="text-muted-foreground mb-4">
											Gallery Mode provides a powerful interface for viewing, filtering, and
											managing your generated NFT collections. Access it by clicking "Gallery Mode"
											in the top-right corner of the main app.
										</p>

										<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
											<div>
												<h4 class="text-foreground mb-3 font-semibold">Collection Management</h4>
												<div class="text-muted-foreground space-y-2 text-sm">
													<p>• Import existing collections from ZIP files</p>
													<p>• View multiple collections in one interface</p>
													<p>• Automatic metadata parsing and organization</p>
													<p>• Collection statistics and insights</p>
												</div>
											</div>
											<div>
												<h4 class="text-foreground mb-3 font-semibold">Advanced Filtering</h4>
												<div class="text-muted-foreground space-y-2 text-sm">
													<p>• Search by NFT name and description</p>
													<p>• Multi-layer trait filtering</p>
													<p>• Sort by rarity, name, or generation date</p>
													<p>• Real-time filter results</p>
												</div>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Interactive Trait Filtering</h3>
										<p class="text-muted-foreground mb-4">
											Click on any trait in NFT details to instantly filter the entire collection by
											that trait. Build complex filters by selecting multiple traits from different
											layers.
										</p>

										<div class="border-border bg-muted rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">
												How Interactive Filtering Works:
											</h4>
											<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
												<li>Click any NFT to view its details in the right panel</li>
												<li>Click on individual traits to filter by that specific attribute</li>
												<li>Selected traits are highlighted with primary color styling</li>
												<li>Build multi-trait filters by clicking additional traits</li>
												<li>Use "Clear All" to reset all active filters</li>
											</ul>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Responsive Design</h3>
										<p class="text-muted-foreground mb-4">
											Gallery Mode is optimized for all devices with adaptive layouts that provide
											the best experience on mobile, tablet, and desktop.
										</p>

										<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Mobile</h4>
												<p class="text-muted-foreground text-sm">
													Full-width grid layout with bottom details panel and horizontal scrolling
													traits
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Tablet</h4>
												<p class="text-muted-foreground text-sm">
													Balanced layout with optimized grid sizing and responsive trait filters
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Desktop</h4>
												<p class="text-muted-foreground text-sm">
													70/30 split layout with fixed right panel and comprehensive NFT details
												</p>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Import Collections</h3>
										<p class="text-muted-foreground mb-4">
											Seamlessly import collections generated by other tools or external platforms
											into Gallery Mode for viewing and filtering.
										</p>

										<div class="border-border bg-muted rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">Supported Import Features:</h4>
											<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
												<li>ZIP files with images/ and metadata/ folder structure</li>
												<li>Automatic metadata parsing and organization</li>
												<li>Automatic rarity calculation and ranking system</li>
												<li>Support for various metadata formats and trait structures</li>
												<li>Duplicate collection name handling with automatic numbering</li>
												<li>Real-time preview during import process</li>
											</ul>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Rarity Calculation System</h3>
										<p class="text-muted-foreground mb-4">
											Gallery Mode automatically calculates rarity scores and ranks for all imported
											NFTs using advanced algorithms that analyze trait distribution across the
											entire collection.
										</p>

										<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
											<div>
												<h4 class="text-foreground mb-3 font-semibold">Trait Rarity Method</h4>
												<p class="text-muted-foreground mb-3 text-sm">
													Each trait's rarity is calculated based on its frequency in the
													collection:
												</p>
												<div class="border-border bg-muted rounded-lg border p-3">
													<p class="text-foreground mb-2 font-mono text-xs">
														Trait Rarity (%) = (Number of NFTs with this trait ÷ Total NFTs) × 100
													</p>
													<p class="text-muted-foreground text-xs">
														Example: If only 50 out of 1000 NFTs have a "Golden Crown" trait, its
														rarity is 5%.
													</p>
												</div>
											</div>
											<div>
												<h4 class="text-foreground mb-3 font-semibold">Overall NFT Score</h4>
												<p class="text-muted-foreground mb-3 text-sm">
													Each NFT's rarity score is calculated by summing its individual trait
													rarity scores (where rarer = higher score):
												</p>
												<div class="border-border bg-muted rounded-lg border p-3">
													<p class="text-foreground mb-2 font-mono text-xs">
														Trait Score = 100 ÷ Trait Percentage
													</p>
													<p class="text-foreground mb-2 font-mono text-xs">
														NFT Score = Sum of all trait scores
													</p>
													<p class="text-muted-foreground text-xs">
														Example: A 5% rare trait = 20 points, 10% trait = 10 points. Total score
														= 30.
													</p>
												</div>
											</div>
										</div>

										<div class="border-border bg-muted mt-4 rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">Ranking System</h4>
											<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
												<li>
													<strong>Rank #1:</strong> Most rare NFT (HIGHEST score - has rarest traits)
												</li>
												<li>
													<strong>Higher numbers:</strong> Less rare NFTs (LOWER scores - more common
													traits)
												</li>
												<li>
													<strong>Sorting:</strong> "Low to High" = common to rare (low score to high
													score)
												</li>
												<li>
													<strong>Sorting:</strong> "High to Low" = rare to common (high score to low
													score)
												</li>
												<li>
													<strong>Visual indicators:</strong> Rarity scores and ranks are displayed in
													NFT details
												</li>
											</ul>
										</div>

										<div class="border-border bg-muted mt-4 rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">How Rarity is Displayed</h4>
											<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
												<div>
													<h5 class="text-foreground mb-1 text-sm font-medium">
														In NFT Details Panel:
													</h5>
													<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-xs">
														<li>Individual trait rarity percentages</li>
														<li>Overall NFT rarity score</li>
														<li>Global rarity rank (e.g., "Rank #42")</li>
													</ul>
												</div>
												<div>
													<h5 class="text-foreground mb-1 text-sm font-medium">
														In Collection Stats:
													</h5>
													<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-xs">
														<li>Rarest NFT in the collection</li>
														<li>Average rarity score across all NFTs</li>
														<li>Total number of unique traits</li>
													</ul>
												</div>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Performance Features</h3>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div>
												<h4 class="text-foreground mb-2 font-semibold">Memory Management</h4>
												<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
													<li>Automatic cache clearing on page refresh</li>
													<li>Efficient image loading and display</li>
													<li>Smart memory cleanup for large collections</li>
												</ul>
											</div>
											<div>
												<h4 class="text-foreground mb-2 font-semibold">User Experience</h4>
												<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
													<li>Smooth animations and transitions</li>
													<li>Real-time search and filtering</li>
													<li>Custom dropdown components for mobile</li>
												</ul>
											</div>
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

				<!-- Strict Pair Section -->
				{#if activeSection === 'strict-pair'}
					<section class="animate-in fade-in duration-300">
						<div class="border-border bg-card rounded-lg border">
							<div class="border-border border-b px-6 py-4">
								<h2 class="text-foreground text-xl font-semibold">Strict Pair Mode</h2>
							</div>
							<div class="px-6 py-6">
								<div class="space-y-8">
									<div>
										<h3 class="text-foreground mb-4 font-semibold">What is Strict Pair Mode?</h3>
										<p class="text-muted-foreground mb-4">
											Strict Pair Mode is an advanced feature that prevents specific trait combinations
											from appearing more than once in your NFT collection. This gives you precise
											control over the uniqueness of specific trait combinations, allowing you to create
											more valuable and strategically designed collections.
										</p>
										<div class="border-border bg-muted rounded-lg border p-4">
											<p class="text-foreground text-sm">
												<strong>Example:</strong> You can ensure that the combination "Light Skin + Hoodie"
												appears only once in your entire collection, making it extremely rare and valuable.
											</p>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Multi-Layer Combinations</h3>
										<p class="text-muted-foreground mb-4">
											Unlike simple 2-layer systems, Strict Pair Mode supports unlimited layer combinations,
											giving you maximum flexibility for creating complex constraints.
										</p>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">2-Layer Example</h4>
												<p class="text-muted-foreground text-sm mb-2">
													BASE + HEAD = 4 × 3 = <strong>12 unique combinations</strong>
												</p>
												<p class="text-muted-foreground text-xs">
													Perfect for simple compatibility rules between two layers.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">4-Layer Example</h4>
												<p class="text-muted-foreground text-sm mb-2">
													BASE + HEAD + ACCESSORY + CLOTHING = 4 × 3 × 5 × 6 = <strong>360 unique combinations</strong>
												</p>
												<p class="text-muted-foreground text-xs">
													Ideal for complex multi-layer constraints and rarity control.
												</p>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">How It Works</h3>
										<div class="space-y-4">
											<ol class="text-muted-foreground ml-6 list-decimal space-y-2">
												<li>
													<strong>Enable Strict Pair Mode:</strong> Toggle the feature in the project settings panel
												</li>
												<li>
													<strong>Create Layer Combinations:</strong> Select 2 or more layers to track (e.g., BASE + HEAD)
												</li>
												<li>
													<strong>Automatic Tracking:</strong> System automatically tracks all possible trait combinations
													between selected layers
												</li>
												<li>
													<strong>Generation Prevention:</strong> During NFT generation, duplicate combinations are
													automatically blocked and regenerated with different traits
												</li>
											</ol>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Creating Layer Combinations</h3>
										<p class="text-muted-foreground mb-4">
											Set up which layer combinations should have unique trait tracking.
										</p>
										<div class="border-border bg-muted mb-4 rounded-lg border p-4">
											<h4 class="text-foreground mb-2 font-semibold">Step-by-Step Guide:</h4>
											<ol class="text-muted-foreground ml-4 list-decimal space-y-1 text-sm">
												<li>Navigate to your project settings</li>
												<li>Find the "Strict Pair Mode" section in the settings panel</li>
												<li>Enable Strict Pair Mode using the toggle button</li>
												<li>Click "Add Layer Combination" to create a new constraint</li>
												<li>Select 2 or more layers from the available layers list</li>
												<li>Review the calculated number of unique combinations</li>
												<li>Add optional description for better organization</li>
												<li>Click "Add Layer Combination" to save your configuration</li>
											</ol>
										</div>
										<div class="border-border bg-muted rounded-lg border p-4">
											<p class="text-foreground text-sm">
												<strong>💡 Pro Tip:</strong> The system automatically calculates how many unique
												combinations will be tracked. For example, selecting BASE (4 traits) + HEAD (3 traits)
												results in 4 × 3 = 12 tracked combinations.
											</p>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Use Cases & Examples</h3>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Ultra-Rare Combinations</h4>
												<p class="text-muted-foreground text-sm">
													Create legendary combinations that appear only once, making them extremely valuable
													and sought after by collectors.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Thematic Consistency</h4>
												<p class="text-muted-foreground text-sm">
													Ensure that certain trait combinations follow your artistic vision without
													unexpected duplicates.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Rarity Engineering</h4>
												<p class="text-muted-foreground text-sm">
													Design the exact rarity distribution for specific trait combinations in your
													collection.
												</p>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Collection Structure</h4>
												<p class="text-muted-foreground text-sm">
													Create sub-collections within your main collection based on unique trait
													combinations.
												</p>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Managing Layer Combinations</h3>
										<p class="text-muted-foreground mb-4">
											Once created, you can manage your layer combinations through the intuitive interface.
										</p>
										<div class="space-y-2">
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">📊</span>
												<span class="text-muted-foreground text-sm">
													<strong>Combination Counter:</strong> Shows total unique combinations that will be tracked
												</span>
											</div>
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">👁️</span>
												<span class="text-muted-foreground text-sm">
													<strong>Active/Inactive Toggle:</strong> Enable or disable combinations without deleting them
												</span>
											</div>
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">🗑️</span>
												<span class="text-muted-foreground text-sm">
													<strong>Delete Button:</strong> Remove combinations you no longer need
												</span>
											</div>
											<div class="flex items-center space-x-3">
												<span class="text-blue-500">ℹ️</span>
												<span class="text-muted-foreground text-sm">
													<strong>Info Button:</strong> View details about the combination and its current status
												</span>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Real-World Examples</h3>
										<div class="space-y-4">
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Example 1: Character + Accessory Pairs</h4>
												<div class="text-muted-foreground text-sm space-y-2">
													<p><strong>Layers:</strong> CHARACTER (5 traits) + ACCESSORY (4 traits)</p>
													<p><strong>Total Combinations:</strong> 5 × 4 = 20 unique combinations</p>
													<p><strong>Result:</strong> Each character-accessory pair appears only once in the collection</p>
													<p><strong>Use Case:</strong> Create 20 unique character outfits, each with guaranteed uniqueness</p>
												</div>
											</div>
											<div class="border-border bg-muted rounded-lg border p-4">
												<h4 class="text-foreground mb-2 font-semibold">Example 2: Multi-Layer Trait Sets</h4>
												<div class="text-muted-foreground text-sm space-y-2">
													<p><strong>Layers:</strong> BASE (4) + HEAD (3) + ACCESSORY (5) + CLOTHING (6)</p>
													<p><strong>Total Combinations:</strong> 4 × 3 × 5 × 6 = 360 unique combinations</p>
													<p><strong>Result:</strong> Each 4-layer combination appears only once</p>
													<p><strong>Use Case:</strong> Create highly structured collections with controlled trait distribution</p>
												</div>
											</div>
										</div>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Best Practices</h3>
										<ul class="text-muted-foreground ml-6 list-disc space-y-2">
											<li>
												<strong>Plan Your Strategy:</strong> Decide which combinations should be rare before
												creating large collections
											</li>
											<li>
												<strong>Test Generation:</strong> Run small test generations to verify Strict Pair
												mode works as expected
											</li>
											<li>
												<strong>Balance Rarity:</strong> Use Strict Pair for ultra-rare combinations, but allow
												other combinations to generate normally for natural rarity distribution
											</li>
											<li>
												<strong>Document Logic:</strong> Keep track of your Strict Pair combinations and their
												intended purpose
											</li>
											<li>
												<strong>Monitor Generation:</strong> Watch the generation process to ensure the system
												is working correctly with your constraints
											</li>
										</ul>
									</div>

									<div>
										<h3 class="text-foreground mb-4 font-semibold">Technical Implementation</h3>
										<p class="text-muted-foreground mb-4">
											Strict Pair Mode uses sophisticated tracking technology to ensure reliable duplicate
											prevention during generation.
										</p>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div>
												<h4 class="text-foreground mb-2 font-semibold">Worker-Level Tracking</h4>
												<p class="text-muted-foreground text-sm">
													Duplicate prevention happens at the worker level for maximum performance and
													reliability, ensuring consistent results across all generation processes.
												</p>
											</div>
											<div>
												<h4 class="text-foreground mb-2 font-semibold">Intelligent Retry Logic</h4>
												<p class="text-muted-foreground text-sm">
													When duplicates are detected, the system automatically retries with different
													traits, maintaining generation efficiency.
												</p>
											</div>
											<div>
												<h4 class="text-foreground mb-2 font-semibold">Memory-Efficient Storage</h4>
												<p class="text-muted-foreground text-sm">
													Used combinations are tracked efficiently with automatic cleanup to prevent
													memory issues during large generation jobs.
												</p>
											</div>
											<div>
												<h4 class="text-foreground mb-2 font-semibold">Persistent Configuration</h4>
												<p class="text-muted-foreground text-sm">
													Your Strict Pair configurations are saved with your project and persist across
													sessions.
												</p>
											</div>
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
