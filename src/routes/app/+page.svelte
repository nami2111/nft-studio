<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import ProjectManagement from '$lib/components/ProjectManagement.svelte';
	import GenerationForm from '$lib/components/GenerationForm.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import StrictPair from '$lib/components/StrictPair.svelte';
	import { projectStore } from '$lib/stores/project.store.svelte';
	import type { StrictPairConfig } from '$lib/types/layer';

	let currentProject = $derived(projectStore.currentProject);

	// Handle Strict Pair config updates
	function handleStrictPairUpdate(config: StrictPairConfig) {
		if (currentProject) {
			projectStore.updateStrictPairConfig(currentProject.id, config);
		}
	}
</script>

<div class="container mx-auto max-w-full overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4">
	<!-- Project Management Section -->
	<div class="mb-3 flex justify-start sm:mb-4">
		<ProjectManagement />
	</div>

	<!-- Main Content Grid -->
	<div class="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-12 xl:grid-cols-12">
		<!-- Left Column: Project Settings and Layer Manager -->
		<div class="space-y-3 sm:space-y-4 lg:col-span-8 xl:col-span-7">
			<!-- Project Settings Card -->
			<div class="bg-card/95 rounded-lg border shadow-sm backdrop-blur-sm">
				<div class="border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
					<h2 class="text-base font-semibold sm:text-lg lg:text-xl">Project Settings</h2>
				</div>
				<div class="p-3 sm:p-4 lg:p-6">
					<ProjectSettings />
				</div>
			</div>

			<!-- Layer Manager -->
			<div class="mt-3 sm:mt-4 lg:mt-6">
				<LayerManager />
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
				<StrictPair
					project={currentProject}
					onupdateStrictPairConfig={handleStrictPairUpdate}
				/>
			{/if}

			<!-- Generation Card -->
			<div class="bg-card/95 rounded-lg border shadow-sm backdrop-blur-sm">
				<div class="border-b px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
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
