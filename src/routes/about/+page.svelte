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
	import Icon from '$components/shared/Icon.svelte';
	import {
		ArrowLeft01Icon,
		File01Icon,
		ZapIcon,
		LayerIcon,
		CpuIcon,
		LaptopPerformanceIcon,
		GithubIcon,
		NewTwitterIcon,
		Crown03Icon,
		Menu01Icon,
		Cancel01Icon,
		Image01Icon,
		Setting07Icon
	} from '@hugeicons/core-free-icons';

	let activeSection = $state('overview');
	let isMobileMenuOpen = $state(false);

	const sections = [
		{ id: 'overview', label: 'Overview', icon: File01Icon, component: AboutOverview },
		{ id: 'quick-start', label: 'Quick Start', icon: ZapIcon, component: AboutQuickStart },
		{ id: 'advanced-features', label: 'Features', icon: LayerIcon, component: AboutAdvancedFeatures },
		{ id: 'gallery-mode', label: 'Gallery Mode', icon: Image01Icon, component: AboutGalleryMode },
		{ id: 'strict-pair', label: 'Strict Pair', icon: Setting07Icon, component: AboutStrictPair },
		{ id: 'ruler-traits', label: 'Ruler Traits', icon: Crown03Icon, component: AboutRulerTraits },
		{ id: 'technical-details', label: 'Technical', icon: CpuIcon, component: AboutTechnicalDetails },
		{ id: 'performance', label: 'Performance', icon: LaptopPerformanceIcon, component: AboutPerformance }
	];

	function showSection(sectionId: string) {
		activeSection = sectionId;
		isMobileMenuOpen = false;
	}

	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}
</script>

{#snippet navMenu()}
	<nav class="space-y-1">
		{#each sections as section (section.id)}
			<button
				class="flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-left transition-all duration-200 {activeSection ===
				section.id
					? 'bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
				onclick={() => showSection(section.id)}
			>
				<Icon icon={section.icon} class="h-4 w-4" />
				<span class="text-sm font-medium">{section.label}</span>
			</button>
		{/each}
	</nav>
{/snippet}

{#snippet sidebarFooter()}
	<div class="border-border mt-8 border-t pt-6">
		<div class="space-y-2">
			<Button variant="outline" size="lg" class="w-full" onclick={() => goto('/app')}>
				Launch Studio
			</Button>
			<Button variant="outline" size="lg" class="w-full" onclick={() => goto('/')}>
				Homepage
			</Button>
		</div>
	</div>

	<div class="border-border mt-6 border-t pt-6">
		<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">Connect</p>
		<div class="mt-3 flex space-x-2">
			<a
				href="https://x.com/aimsomnia"
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
				title="Follow on X (Twitter)"
			>
				<Icon icon={NewTwitterIcon} class="h-4 w-4" />
			</a>
			<a
				href="https://github.com/nami2111"
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
				title="Follow on GitHub"
			>
				<Icon icon={GithubIcon} class="h-4 w-4" />
			</a>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>About GNStudio - Documentation</title>
	<meta name="description" content="GNStudio: Browser-based platform for creating generative art collections" />
</svelte:head>

<div class="bg-background min-h-screen">
	<!-- Mobile Header -->
	<div class="card-brutalist bg-card sticky top-0 z-20 sm:hidden">
		<div class="flex items-center justify-between px-4 py-3">
			<div class="flex items-center space-x-3">
				<Button
					variant="ghost"
					size="icon"
					class="text-muted-foreground hover:text-foreground"
					onclick={toggleMobileMenu}
					aria-label="Open navigation menu"
				>
					<Icon icon={Menu01Icon} class="h-5 w-5" />
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
				aria-label="Go back"
			>
				<Icon icon={ArrowLeft01Icon} class="h-5 w-5" />
			</Button>
		</div>
	</div>

	<!-- Mobile Navigation Overlay -->
	{#if isMobileMenuOpen}
		<div class="fixed inset-0 z-30 sm:hidden">
			<div
				class="bg-background/50 fixed inset-0"
				role="button"
				tabindex="0"
				aria-label="Close mobile menu"
				onclick={closeMobileMenu}
				onkeydown={(e) => e.key === 'Enter' && closeMobileMenu()}
			></div>
			<div class="card-brutalist border-foreground bg-card fixed top-0 left-0 h-full w-80">
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
							aria-label="Close menu"
						>
							<Icon icon={Cancel01Icon} class="h-5 w-5" />
						</Button>
					</div>

					{@render navMenu()}
					{@render sidebarFooter()}
				</div>
			</div>
		</div>
	{/if}

	<!-- Desktop Side Navigation -->
	<aside class="card-brutalist border-foreground bg-card fixed top-0 left-0 z-10 hidden h-screen w-64 flex-col sm:flex">
		<div class="flex flex-1 flex-col overflow-y-auto p-6">
			<div class="mb-6">
				<Button
					variant="ghost"
					class="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					onclick={() => history.back()}
				>
					<Icon icon={ArrowLeft01Icon} class="mr-2 h-4 w-4" />
					Back
				</Button>
			</div>

			<div class="mb-8">
				<h1 class="text-foreground text-xl font-bold">GNStudio</h1>
				<p class="text-muted-foreground mt-1 text-sm">Documentation</p>
			</div>

			{@render navMenu()}

			<div class="mt-auto">
				{@render sidebarFooter()}
			</div>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="sm:ml-64">
		<div class="w-full px-4 py-6 sm:px-8 sm:py-12">
			<div class="mb-6 sm:mb-8">
				<h1 class="text-foreground mb-2 text-2xl font-bold sm:text-3xl">GNStudio</h1>
				<p class="text-muted-foreground text-base sm:text-lg">
					Browser-based platform for creating generative art collections with advanced
					layer management and high-performance generation.
				</p>
			</div>

			<div class="w-full">
				{#if activeSection === 'overview'}
					<AboutOverview />
				{:else if activeSection === 'quick-start'}
					<AboutQuickStart />
				{:else if activeSection === 'advanced-features'}
					<AboutAdvancedFeatures />
				{:else if activeSection === 'gallery-mode'}
					<AboutGalleryMode />
				{:else if activeSection === 'strict-pair'}
					<AboutStrictPair />
				{:else if activeSection === 'ruler-traits'}
					<AboutRulerTraits />
				{:else if activeSection === 'technical-details'}
					<AboutTechnicalDetails />
				{:else if activeSection === 'performance'}
					<AboutPerformance />
				{/if}
			</div>
		</div>
	</div>
</div>
