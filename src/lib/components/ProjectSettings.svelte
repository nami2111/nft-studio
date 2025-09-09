<script lang="ts">
	import {
		projectStore as project,
		updateProjectName,
		updateProjectDescription
	} from '$lib/stores/runes-store';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';

	let projectName = $state('');
	let projectDescription = $state('');
	let nameTimeout: NodeJS.Timeout;
	let descTimeout: NodeJS.Timeout;
	const MAX_NAME_LENGTH = 100;
	const MAX_DESC_LENGTH = 500;

	// Subscribe to project changes using $effect
	$effect(() => {
		const currentProject = $project;
		if (currentProject.name !== projectName) projectName = currentProject.name;
		if (currentProject.description !== projectDescription)
			projectDescription = currentProject.description;
	});

	// Debounced save for name
	function debounceNameSave(value: string) {
		clearTimeout(nameTimeout);
		projectName = value;
		if (projectName.trim() === '') {
			toast.error('Project name cannot be empty.');
			return;
		}
		if (projectName.length > MAX_NAME_LENGTH) {
			toast.error(`Project name cannot exceed ${MAX_NAME_LENGTH} characters.`);
			return;
		}
		nameTimeout = setTimeout(() => {
			untrack(() => updateProjectName(projectName));
			toast.success('Project name saved.');
		}, 500);
	}

	// Debounced save for description
	function debounceDescSave(value: string) {
		clearTimeout(descTimeout);
		projectDescription = value;
		if (projectDescription.length > MAX_DESC_LENGTH) {
			toast.error(`Description cannot exceed ${MAX_DESC_LENGTH} characters.`);
			return;
		}
		descTimeout = setTimeout(() => {
			untrack(() => updateProjectDescription(projectDescription));
		}, 500);
	}

	// Cleanup timeouts on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		clearTimeout(nameTimeout);
		clearTimeout(descTimeout);
	});
</script>

<div class="space-y-4">
	<div>
		<label for="projectName" class="block text-sm font-medium text-gray-700">Project Name</label>
		<Input
			id="projectName"
			type="text"
			value={projectName}
			on:input={(e) => debounceNameSave(e.currentTarget.value)}
			placeholder="Enter project name"
			maxLength={MAX_NAME_LENGTH}
		/>
		<p class="mt-1 text-xs text-gray-500">{projectName.length}/{MAX_NAME_LENGTH}</p>
	</div>

	<div>
		<label for="projectDescription" class="block text-sm font-medium text-gray-700"
			>Description</label
		>
		<Textarea
			id="projectDescription"
			rows="3"
			value={projectDescription}
			on:input={(e) => debounceDescSave(e.currentTarget.value)}
			placeholder="Enter project description"
			maxLength={MAX_DESC_LENGTH}
		/>
		<p class="mt-1 text-xs text-gray-500">{projectDescription.length}/{MAX_DESC_LENGTH}</p>
	</div>

	<div class="rounded-md bg-blue-50 p-4">
		<h3 class="mb-2 text-sm font-medium text-blue-800">Project Dimensions</h3>
		<p class="mb-2 text-sm text-blue-800">
			Width: {$project.outputSize.width}px x Height: {$project.outputSize.height}px
		</p>
		<p class="text-sm text-blue-800">
			Dimensions are automatically set based on your uploaded image files. The first image uploaded
			will determine the project output size.
		</p>
	</div>
</div>
