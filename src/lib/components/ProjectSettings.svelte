<script lang="ts">
	import { projectStore } from '$lib/stores';
	import { untrack } from 'svelte';

	let projectName = '';
	let projectDescription = '';

	projectStore.project.subscribe((p) => {
		projectName = p.name;
		projectDescription = p.description;
	});

	function handleNameChange() {
		untrack(() => {
			projectStore.updateProjectName(projectName);
		});
	}

	function handleDescriptionChange() {
		untrack(() => {
			projectStore.updateProjectDescription(projectDescription);
		});
	}
</script>

<div class="space-y-4">
	<div>
		<label for="projectName" class="block text-sm font-medium text-gray-700">Project Name</label>
		<input
			id="projectName"
			type="text"
			class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			bind:value={projectName}
			onchange={handleNameChange}
			placeholder="Enter project name"
		/>
	</div>

	<div>
		<label for="projectDescription" class="block text-sm font-medium text-gray-700"
			>Description</label
		>
		<textarea
			id="projectDescription"
			rows="3"
			class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="Enter project description"
			bind:value={projectDescription}
			onchange={handleDescriptionChange}
		></textarea>
	</div>

	<div class="rounded-md bg-blue-50 p-4">
		<p class="text-sm text-blue-800">
			Dimensions are automatically set based on your uploaded image files. The first image uploaded
			will determine the project output size.
		</p>
	</div>
</div>
