<script lang="ts">
	import { project } from '$lib/stores/project.store';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	let projectName = '';
	let projectDescription = '';

	project.subscribe((p: any) => {
		projectName = p.name;
		projectDescription = p.description;
	});

	function handleNameChange() {
		if (projectName.trim() === '') {
			toast.error('Project name cannot be empty.');
			// Revert to the current project name
			const currentProject = $project;
			projectName = currentProject.name;
			return;
		}
		
		if (projectName.length > 100) {
			toast.error('Project name cannot exceed 100 characters.');
			// Revert to the current project name
			const currentProject = $project;
			projectName = currentProject.name;
			return;
		}
		
		untrack(() => {
			// Update project name using the store's update method
			project.update(currentProject => ({
				...currentProject,
				name: projectName
			}));
		});
	}

	function handleDescriptionChange() {
		untrack(() => {
			// Update project description using the store's update method
			project.update(currentProject => ({
				...currentProject,
				description: projectDescription
			}));
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
