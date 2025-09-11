<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import ProjectManagement from '$lib/components/ProjectManagement.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import Preview from '$lib/components/Preview.svelte';
</script>

<div class="container mx-auto py-4 sm:py-6">
	<!-- Project Management Section -->
	<div class="mb-4 flex justify-start sm:mb-6">
		<ProjectManagement />
	</div>

	<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
		<div class="space-y-4 sm:space-y-6 lg:col-span-2">
			<!-- Project Settings Card -->
			<div
				class="rounded-xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
			>
				<div class="border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
					<h2 class="text-lg font-semibold text-gray-800">Project Settings</h2>
				</div>
				<div class="p-4 sm:p-6">
					<ProjectSettings />
				</div>
			</div>

			<!-- Layer Manager -->
			<div class="mt-4 sm:mt-6">
				<LayerManager />
			</div>
		</div>

		<div class="space-y-4 sm:space-y-6 lg:col-span-1">
			<!-- Preview -->
			<Preview />

			<!-- Generation Card -->
			<div
				class="rounded-xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
			>
				<div class="border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
					<h2 class="text-lg font-semibold text-gray-800">Generate Collection</h2>
				</div>
				<div class="p-4 sm:p-6">
					<div class="flex justify-center">
						<GenerationModal />
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
