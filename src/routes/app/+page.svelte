<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import ProjectManagement from '$lib/components/ProjectManagement.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import Preview from '$lib/components/Preview.svelte';
</script>

<div class="container mx-auto py-6">
	<!-- Project Management Section -->
	<div class="mb-6 flex justify-start lg:col-span-2">
		<ProjectManagement />
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<!-- Project Settings Card -->
			<div
				class="rounded-xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
			>
				<div class="border-b border-gray-200 px-6 py-4">
					<h2 class="text-lg font-semibold text-gray-800">Project Settings</h2>
				</div>
				<div class="p-6">
					<ProjectSettings />
				</div>
			</div>

			<!-- Layer Manager -->
			<div class="mt-6">
				<LayerManager />
			</div>
		</div>

		<div class="space-y-6 lg:col-span-1">
			<!-- Preview -->
			<Preview />

			<!-- Generation Card -->
			<div
				class="rounded-xl border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md"
			>
				<div class="border-b border-gray-200 px-6 py-4">
					<h2 class="text-lg font-semibold text-gray-800">Generate Collection</h2>
				</div>
				<div class="p-6">
					<div class="flex justify-center">
						<GenerationModal />
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
