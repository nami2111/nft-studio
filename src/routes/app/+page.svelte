<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import ProjectManagement from '$lib/components/ProjectManagement.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import Preview from '$lib/components/Preview.svelte';
</script>

<div class="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
	<!-- Project Management Section -->
	<div class="mb-3 flex justify-start sm:mb-4">
		<ProjectManagement />
	</div>

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-12">
		<!-- Left Column: Project Settings and Layer Manager -->
		<div class="space-y-3 sm:space-y-4 lg:col-span-8">
			<!-- Project Settings Card -->
			<div class="rounded-lg border border-gray-200 bg-white/90 shadow-sm backdrop-blur-sm">
				<div class="border-b border-gray-200 px-3 py-2 sm:px-4 sm:py-3">
					<h2 class="text-base font-semibold text-gray-800 sm:text-lg">Project Settings</h2>
				</div>
				<div class="p-3 sm:p-4">
					<ProjectSettings />
				</div>
			</div>

			<!-- Layer Manager -->
			<div class="mt-3 sm:mt-4">
				<LayerManager />
			</div>
		</div>

		<!-- Right Column: Preview and Generation -->
		<div class="space-y-3 sm:space-y-4 lg:col-span-4">
			<!-- Preview -->
			<div class="lg:sticky lg:top-4">
				<Preview />
			</div>

			<!-- Generation Card -->
			<div class="rounded-lg border border-gray-200 bg-white/90 shadow-sm backdrop-blur-sm">
				<div class="border-b border-gray-200 px-3 py-2 sm:px-4 sm:py-3">
					<h2 class="text-base font-semibold text-gray-800 sm:text-lg">Generate Collection</h2>
				</div>
				<div class="p-3 sm:p-4">
					<div class="flex justify-center">
						<GenerationModal />
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
