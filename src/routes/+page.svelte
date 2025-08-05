<script lang="ts">
	import ProjectSettings from '$lib/components/ProjectSettings.svelte';
	import LayerManager from '$lib/components/LayerManager.svelte';
	import GenerationModal from '$lib/components/GenerationModal.svelte';
	import { project } from '$lib/stores/project.store';
</script>

<div class="py-6">
	<ProjectSettings />

	<LayerManager />

	<div class="mt-6 flex justify-center">
		<GenerationModal />
	</div>
</div>
