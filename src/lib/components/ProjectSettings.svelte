<script lang="ts">
	import { project, updateProjectName, updateProjectDescription } from '$lib/stores';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { showSuccess, showWarning } from '$lib/utils/error-handling';
	// import type { Project } from '$lib/types/project';

	let projectName = $state('');
	let projectDescription = $state('');
	const MAX_NAME_LENGTH = 100;
	const MAX_DESC_LENGTH = 500;

	// Sync with project store changes
	$effect(() => {
		const currentProject = project;
		// Always sync with the current project data
		projectName = currentProject.name;
		projectDescription = currentProject.description;
	});

	// Save project name
	function saveProjectName(value: string) {
		projectName = value;
		if (projectName.trim() === '') {
			showWarning('Project name cannot be empty.', {
				description: 'Validation Error'
			});
			return;
		}
		if (projectName.length > MAX_NAME_LENGTH) {
			showWarning(`Project name cannot exceed ${MAX_NAME_LENGTH} characters.`, {
				description: 'Validation Error'
			});
			return;
		}
		updateProjectName(projectName);
		showSuccess('Project name saved.');
	}

	// Save project description
	function saveProjectDescription(value: string) {
		projectDescription = value;
		if (projectDescription.length > MAX_DESC_LENGTH) {
			showWarning(`Description cannot exceed ${MAX_DESC_LENGTH} characters.`, {
				description: 'Validation Error'
			});
			return;
		}
		updateProjectDescription(projectDescription);
	}
</script>

<div class="space-y-3 sm:space-y-4">
	<div>
		<label for="projectName" class="text-foreground block text-xs font-medium sm:text-sm"
			>Project Name</label
		>
		<Input
			id="projectName"
			type="text"
			value={projectName}
			onchange={(e: Event) => saveProjectName((e.target as HTMLInputElement).value)}
			onkeydown={(e) => e.key === 'Enter' && saveProjectName(projectName)}
			placeholder="Enter project name"
			class="text-xs sm:text-sm"
		/>
		<p class="text-muted-foreground mt-1 text-xs">{projectName.length}/{MAX_NAME_LENGTH}</p>
	</div>

	<div>
		<label for="projectDescription" class="text-foreground block text-xs font-medium sm:text-sm"
			>Description</label
		>
		<Textarea
			id="projectDescription"
			rows={2}
			value={projectDescription}
			onchange={(e: Event) => saveProjectDescription((e.target as HTMLTextAreaElement).value)}
			placeholder="Enter project description"
			class="text-xs sm:text-sm"
		/>
		<p class="text-muted-foreground mt-1 text-xs">{projectDescription.length}/{MAX_DESC_LENGTH}</p>
	</div>

	<div class="bg-muted rounded-md p-3 sm:p-4">
		<h3 class="text-foreground mb-1 text-xs font-medium sm:mb-2 sm:text-sm">Project Dimensions</h3>
		<p class="text-muted-foreground mb-1 text-xs sm:mb-2 sm:text-sm">
			Width: {project.outputSize.width}px x Height: {project.outputSize.height}px
		</p>
		<p class="text-muted-foreground text-xs sm:text-sm">
			Dimensions are automatically set based on your uploaded image files. The first image uploaded
			will determine the project output size.
		</p>
	</div>
</div>
