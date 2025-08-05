<script lang="ts">
	import {
		project,
		updateProjectName,
		updateProjectDescription,
		updateProjectDimensions
	} from '$lib/stores/project.store';
	import { untrack } from 'svelte';

	let projectName = $state('');
	let projectDescription = $state('');
	let projectWidth = $state(1024);
	let projectHeight = $state(1024);

	// Subscribe to store changes
	project.subscribe((p) => {
		projectName = p.name;
		projectDescription = p.description;
		projectWidth = p.outputSize.width;
		projectHeight = p.outputSize.height;
	});

	function handleNameInput(e: Event) {
		const target = e.target as HTMLInputElement;
		updateProjectName(target.value);
	}

	function handleDescriptionInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		updateProjectDescription(target.value);
	}

	function handleWidthInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const width = parseInt(target.value) || 1;
		updateProjectDimensions(width, projectHeight);
	}

	function handleHeightInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const height = parseInt(target.value) || 1;
		updateProjectDimensions(projectWidth, height);
	}
</script>

<div class="rounded-lg bg-white p-6 shadow">
	<h2 class="mb-4 text-xl font-bold text-gray-800">Project Settings</h2>

	<div class="space-y-4">
		<div>
			<label for="projectName" class="block text-sm font-medium text-gray-700">Project Name</label>
			<input
				id="projectName"
				type="text"
				class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				value={projectName}
				oninput={handleNameInput}
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
				value={projectDescription}
				oninput={handleDescriptionInput}
			></textarea>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="width" class="block text-sm font-medium text-gray-700">Width (px)</label>
				<input
					id="width"
					type="number"
					min="1"
					class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					value={projectWidth}
					oninput={handleWidthInput}
					placeholder="Width"
				/>
			</div>

			<div>
				<label for="height" class="block text-sm font-medium text-gray-700">Height (px)</label>
				<input
					id="height"
					type="number"
					min="1"
					class="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					value={projectHeight}
					oninput={handleHeightInput}
					placeholder="Height"
				/>
			</div>
		</div>
	</div>
</div>
