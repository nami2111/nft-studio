<script lang="ts">
	import ProjectSettings from '$lib/components/project/ProjectSettings.svelte';
	import ProjectManagement from '$lib/components/project/ProjectManagement.svelte';
	import GenerationForm from '$lib/components/generation/GenerationForm.svelte';
	import Preview from '$lib/components/generation/Preview.svelte';
	import StrictPair from '$lib/components/layer/StrictPair.svelte';
	import { projectStore } from '$lib/stores/project.store.svelte';
	import type { StrictPairConfig } from '$lib/types/layer';
	import { onMount, type Component } from 'svelte';

	const currentProject = $derived(projectStore.currentProject);

	// Lazy-loaded components for code splitting
	let LayerManager = $state<Component | null>(null);
	let PerformanceMonitor = $state<Component | null>(null);
	let CacheMonitor = $state<Component | null>(null);

	// Loading states for lazy components
	let isLoadingLayerManager = $state(false);
	let isLoadingPerformanceMonitor = $state(false);
	let isLoadingCacheMonitor = $state(false);

	// Handle Strict Pair config updates
	function handleStrictPairUpdate(config: StrictPairConfig) {
		if (currentProject) {
			projectStore.updateStrictPairConfig(currentProject.id, config);
		}
	}

	// Lazy load Layer Manager when needed
	async function loadLayerManager() {
		if (!LayerManager && !isLoadingLayerManager) {
			isLoadingLayerManager = true;
			try {
				const module = await import('$lib/components/layer/LayerManager.svelte');
				LayerManager = module.default as unknown as Component;
			} catch (error) {
				console.error('Failed to load LayerManager:', error);
			} finally {
				isLoadingLayerManager = false;
			}
		}
	}

	// Lazy load Performance Monitor (for development/optimization)
	async function loadPerformanceMonitor() {
		if (!PerformanceMonitor && !isLoadingPerformanceMonitor) {
			isLoadingPerformanceMonitor = true;
			try {
				const module = await import('$lib/components/monitor/PerformanceMonitor.svelte');
				PerformanceMonitor = module.default as unknown as Component;
			} catch (error) {
				console.error('Failed to load PerformanceMonitor:', error);
			} finally {
				isLoadingPerformanceMonitor = false;
			}
		}
	}

	// Lazy load Cache Monitor
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async function loadCacheMonitor() {
		if (!CacheMonitor && !isLoadingCacheMonitor) {
			isLoadingCacheMonitor = true;
			try {
				const module = await import('$lib/components/monitor/CacheMonitor.svelte');
				CacheMonitor = module.default as unknown as Component;
			} catch (error) {
				console.error('Failed to load CacheMonitor:', error);
			} finally {
				isLoadingCacheMonitor = false;
			}
		}
	}

	// Load development tools only in development mode
	onMount(() => {
		if (import.meta.env.DEV) {
			// Preload performance monitor after a delay in development
			setTimeout(() => {
				loadPerformanceMonitor();
			}, 2000);
		}
	});
</script>

<svelte:head>
	<title>GNStudio Workspace</title>
	<meta name="description" content="Design layers, configure traits, and generate your art collection with GNStudio." />
</svelte:head>

<div class="w-full overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4">
	<!-- Project Management Section -->
	<div class="mb-3 flex justify-start sm:mb-4">
		<ProjectManagement />
	</div>

	<!-- Main Content Grid -->
	<div class="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-12 xl:grid-cols-12">
		<!-- Left Column: Project Settings and Layer Manager -->
		<div class="space-y-3 sm:space-y-4 lg:col-span-8 xl:col-span-7">
			<!-- Project Settings Card -->
			<div class="bg-card/95 rounded-lg border-2 shadow-sm backdrop-blur-sm">
				<div class="border-b-2 px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
					<h2 class="text-base font-semibold sm:text-lg lg:text-xl">Project Settings</h2>
				</div>
				<div class="p-3 sm:p-4 lg:p-6">
					<ProjectSettings />
				</div>
			</div>

			<!-- Layer Manager -->
			<div class="mt-3 sm:mt-4 lg:mt-6">
				{#if LayerManager}
					<LayerManager />
				{:else if isLoadingLayerManager}
					<div class="bg-card/95 rounded-lg border-2 shadow-sm backdrop-blur-sm">
						<div class="border-b-2 px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
							<h2 class="text-base font-semibold sm:text-lg lg:text-xl">Layer Manager</h2>
						</div>
						<div class="p-3 sm:p-4 lg:p-6">
							<div class="flex items-center justify-center py-8">
								<div class="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
								<span class="text-muted-foreground ml-2 text-sm">Loading Layer Manager...</span>
							</div>
						</div>
					</div>
				{:else}
					<button
						onclick={loadLayerManager}
						class="bg-card/95 hover:bg-card w-full rounded-lg border-2 p-4 shadow-sm backdrop-blur-sm transition-colors"
					>
						<div class="flex items-center justify-center py-4">
							<span class="text-muted-foreground text-sm">Click to load Layer Manager</span>
						</div>
					</button>
				{/if}
			</div>
		</div>

		<!-- Right Column: Preview, Strict Pair, and Generation -->
		<div class="space-y-3 sm:space-y-4 lg:col-span-4 xl:col-span-5">
			<!-- Preview -->
			<div class="lg:sticky lg:top-4 xl:top-6">
				<Preview />
			</div>

			<!-- Strict Pair Card -->
			{#if currentProject}
				<StrictPair project={currentProject} onupdateStrictPairConfig={handleStrictPairUpdate} />
			{/if}

			<!-- Generation Card -->
			<div class="bg-card/95 rounded-lg border-2 shadow-sm backdrop-blur-sm">
				<div class="border-b-2 px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
					<h2 class="text-base font-semibold sm:text-lg lg:text-xl">Generate Collection</h2>
				</div>
				<div class="p-3 sm:p-4 lg:p-6">
					<div class="flex justify-center">
						<GenerationForm />
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
