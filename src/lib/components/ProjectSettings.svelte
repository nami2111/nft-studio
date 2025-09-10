<script lang="ts">
	import { project, updateProjectName, updateProjectDescription } from '$lib/stores/runes-store';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	// import type { Project } from '$lib/types/project';

	let projectName = $state('');
	let projectDescription = $state('');
	const MAX_NAME_LENGTH = 100;
	const MAX_DESC_LENGTH = 500;

	// Initialize from project store
	$effect(() => {
		const currentProject = $project;
		// Only set initial values if they haven't been set yet
		if (projectName === '') {
			projectName = currentProject.name;
		}
		if (projectDescription === '') {
			projectDescription = currentProject.description;
		}
	});

	// Save project name
	function saveProjectName(value: string) {
		projectName = value;
		if (projectName.trim() === '') {
			toast.error('Project name cannot be empty.');
			return;
		}
		if (projectName.length > MAX_NAME_LENGTH) {
			toast.error(`Project name cannot exceed ${MAX_NAME_LENGTH} characters.`);
			return;
		}
		updateProjectName(projectName);
		toast.success('Project name saved.');
	}

	// Save project description
	function saveProjectDescription(value: string) {
		projectDescription = value;
		if (projectDescription.length > MAX_DESC_LENGTH) {
			toast.error(`Description cannot exceed ${MAX_DESC_LENGTH} characters.`);
			return;
		}
		updateProjectDescription(projectDescription);
	}
</script>

<div class="space-y-4">
	<div>
		<label for="projectName" class="block text-sm font-medium text-gray-900">Project Name</label>
		<Input
			id="projectName"
			type="text"
			value={projectName}
			onchange={(e: Event) => saveProjectName((e.target as HTMLInputElement).value)}
			onkeydown={(e) => e.key === 'Enter' && saveProjectName(projectName)}
			placeholder="Enter project name"
		/>
		<p class="mt-1 text-xs text-gray-600">{projectName.length}/{MAX_NAME_LENGTH}</p>
	</div>

	<div>
		<label for="projectDescription" class="block text-sm font-medium text-gray-900"
			>Description</label
		>
		<Textarea
			id="projectDescription"
			rows={3}
			value={projectDescription}
			onchange={(e: Event) => saveProjectDescription((e.target as HTMLTextAreaElement).value)}
			placeholder="Enter project description"
		/>
		<p class="mt-1 text-xs text-gray-600">{projectDescription.length}/{MAX_DESC_LENGTH}</p>
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
