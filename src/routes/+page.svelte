<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import ProjectManagement from '$lib/components/ProjectManagement.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import Preview from '$lib/components/Preview.svelte';
</script>

<div class="container mx-auto py-8">
	<!-- Project Management Section -->
	<div class="mb-6 flex justify-center">
		<ProjectManagement />
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<div class="mb-6 rounded-lg bg-white p-6 shadow">
				<h2 class="mb-4 text-xl font-bold text-gray-800">Project Settings</h2>
				<ProjectSettings />
			</div>
			<LayerManager />
		</div>

		<div class="lg:col-span-1">
			<div class="sticky top-8">
				<Preview />
			</div>
		</div>
	</div>

	<div class="mt-8 flex justify-center">
		<GenerationModal />
	</div>
</div>
