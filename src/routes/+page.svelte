<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import Preview from '$lib/components/Preview.svelte';
</script>

<div class="container mx-auto py-8">
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<ProjectSettings />
			<LayerManager />
		</div>

		<div class="lg:col-span-1">
			<Preview />
		</div>
	</div>

	<div class="mt-8 flex justify-center">
		<GenerationModal />
	</div>
</div>
