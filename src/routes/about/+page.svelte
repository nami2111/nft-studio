<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import AboutOverview from '$lib/components/about/AboutOverview.svelte';
	import AboutQuickStart from '$lib/components/about/AboutQuickStart.svelte';
	import AboutAdvancedFeatures from '$lib/components/about/AboutAdvancedFeatures.svelte';
	import AboutGalleryMode from '$lib/components/about/AboutGalleryMode.svelte';
	import AboutStrictPair from '$lib/components/about/AboutStrictPair.svelte';
	import AboutRulerTraits from '$lib/components/about/AboutRulerTraits.svelte';
	import AboutTechnicalDetails from '$lib/components/about/AboutTechnicalDetails.svelte';
	import AboutPerformance from '$lib/components/about/AboutPerformance.svelte';
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
	} from '@lucide/svelte';

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
	<title>About GNStudio - Documentation</title>
	<meta
		name="description"
		content="GNStudio: Browser-based platform for creating generative art collections"
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
					<h1 class="text-foreground text-lg font-bold">GNStudio</h1>
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
							<h1 class="text-foreground text-lg font-bold">GNStudio</h1>
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
								<section.icon class="h-4 w-4" />
								<span class="text-sm font-medium">{section.label}</span>
							</button>
						{/each}
					</nav>

					<!-- Quick Actions -->
					<div class="border-border mt-6 border-t pt-6">
						<div class="space-y-2">
							<Button
								variant="outline"
								size="lg"
								class="w-full"
								onclick={() => goto('/app')}
							>
								Launch Studio
							</Button>
							<Button
								variant="outline"
								size="lg"
								class="w-full"
								onclick={() => goto('/')}
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
				<h1 class="text-foreground text-xl font-bold">GNStudio</h1>
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
						<section.icon class="h-4 w-4" />
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
						class="w-full"
						onclick={() => goto('/app')}
					>
						Launch Studio
					</Button>
					<Button
						variant="outline"
						size="lg"
						class="w-full"
						onclick={() => goto('/')}
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
			<h1 class="text-foreground mb-2 text-2xl font-bold sm:text-3xl">GNStudio</h1>
				<p class="text-muted-foreground text-base sm:text-lg">
					Browser-based platform for creating generative art collections with advanced
					layer management and high-performance generation.
				</p>
				</div>
			</div>

			<!-- Dynamic Content Section -->
			<div class="w-full">
				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<AboutOverview />
				{/if}

				<!-- Quick Start Section -->
				{#if activeSection === 'quick-start'}
					<AboutQuickStart />
				{/if}

				<!-- Advanced Features Section -->
				{#if activeSection === 'advanced-features'}
					<AboutAdvancedFeatures />
				{/if}

				<!-- Gallery Mode Section -->
				{#if activeSection === 'gallery-mode'}
					<AboutGalleryMode />
				{/if}

				<!-- Strict Pair Section -->
				{#if activeSection === 'strict-pair'}
					<AboutStrictPair />
				{/if}

				<!-- Ruler Traits Section -->
				{#if activeSection === 'ruler-traits'}
					<AboutRulerTraits />
				{/if}

				<!-- Technical Details Section -->
				{#if activeSection === 'technical-details'}
					<AboutTechnicalDetails />
				{/if}

				<!-- Performance Section -->
				{#if activeSection === 'performance'}
					<AboutPerformance />
				{/if}
			</div>
		</div>
	</div>
</div>