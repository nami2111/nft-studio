<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';
	import {
		loadProjectFromZip,
		saveProjectToZip,
		project,
		projectNeedsZipLoad,
		markProjectAsLoaded,
		getLoadingState,
		getDetailedLoadingState,
		startDetailedLoading,
		stopDetailedLoading
	} from '$lib/stores';
	import { FolderOpen, Save, AlertTriangle, Upload, Download } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import {
		Dialog,
		DialogTrigger,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';

	let loadDialogOpen = $state(false);
	let saveDialogOpen = $state(false);
	let loadFileInputElement: HTMLInputElement | null = null;
	let saveFileInputElement: HTMLInputElement | null = null;
	let isProjectLoading = $derived(getLoadingState('project-load'));
	let isProjectSaving = $derived(getLoadingState('project-save'));
	let projectLoadProgress = $derived(getDetailedLoadingState('project-load'));
	let projectSaveProgress = $derived(getDetailedLoadingState('project-save'));

	// Track unsaved changes
	let hasUnsavedChanges = $derived(
		project.layers.length > 0 || project.name.trim() !== '' || project.description.trim() !== ''
	);

	function triggerFileInput() {
		if (loadFileInputElement) {
			loadFileInputElement.click();
		}
	}

	// async function confirmAndSave() {
	// 	if (!hasUnsavedChanges) return true;
	// 	const confirmed = confirm('You have unsaved changes. Do you want to save before proceeding?');
	// 	if (confirmed) {
	// 		try {
	// 			await saveProjectToZip();
	// 			toast.success('Project saved successfully!');
	// 		} catch (error) {
	// 			toast.error(error instanceof Error ? error.message : 'Failed to save project');
	// 			return false;
	// 		}
	// 	}
	// 	return true;
	// }

	async function handleSaveProject() {
		try {
			startDetailedLoading('project-save', 100);
			await saveProjectToZip();
			toast.success('Project saved successfully!');
			saveDialogOpen = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to save project';
			toast.error(message);
		} finally {
			// Reset file input
			if (saveFileInputElement) {
				saveFileInputElement.value = '';
			}
			stopDetailedLoading('project-save');
		}
	}

	async function handleLoadProject(files: FileList | null) {
		if (!files || files.length === 0) {
			toast.error('Please select a valid .zip project file');
			return;
		}

		const file = files[0];
		if (!file.name.endsWith('.zip')) {
			toast.error('Please select a valid .zip project file');
			return;
		}

		// Warn about unsaved changes before loading
		if (hasUnsavedChanges) {
			const proceed = confirm(
				'Loading a new project will discard current unsaved changes. Proceed?'
			);
			if (!proceed) return;
		}

		try {
			startDetailedLoading('project-load', 100);
			await loadProjectFromZip(file);
			markProjectAsLoaded();
			toast.success('Project loaded successfully!');
			loadDialogOpen = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load project';
			toast.error(message);
		} finally {
			// Reset file input
			if (loadFileInputElement) {
				loadFileInputElement.value = '';
			}
			stopDetailedLoading('project-load');
		}
	}
</script>

<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
	{#if projectNeedsZipLoad()}
		<Card class="mb-2 w-full border border-yellow-200 bg-yellow-50 p-2 text-xs sm:text-sm">
			<CardContent class="flex items-center p-0">
				<AlertTriangle class="mr-1.5 h-3 w-3 text-yellow-600 sm:mr-2 sm:h-4 sm:w-4" />
				<p class="text-yellow-800">Don't forget to save your Project first before generate.</p>
			</CardContent>
		</Card>
	{/if}

	<!-- Load Project Dialog -->
	<Dialog bind:open={loadDialogOpen}>
		<DialogTrigger>
			<Button
				variant="outline"
				size="sm"
				class="w-full border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:px-4"
			>
				<Upload class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
				<span class="xs:inline hidden">Load Project</span>
				<span class="xs:hidden">Load</span>
			</Button>
		</DialogTrigger>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Load Project</DialogTitle>
				<DialogDescription>
					Upload a previously saved project ZIP file to restore your configuration and images.
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-3 sm:space-y-4">
				<div
					class="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center transition-colors hover:border-blue-500 hover:border-gray-400 sm:p-6 {isProjectLoading
						? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500'
						: ''}"
					role="button"
					tabindex="0"
					ondragover={(e) => {
						e.preventDefault();
						if (e.dataTransfer) {
							e.dataTransfer.dropEffect = 'copy';
						}
					}}
					ondragenter={(e) => e.preventDefault()}
					ondragleave={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						if (e.dataTransfer) {
							const files = e.dataTransfer.files;
							handleLoadProject(files);
						}
					}}
				>
					<input
						bind:this={loadFileInputElement}
						type="file"
						accept=".zip"
						class="hidden"
						onchange={(e) => handleLoadProject((e.target as HTMLInputElement).files)}
					/>
					<FolderOpen class="mx-auto mb-3 h-8 w-8 text-gray-400 sm:mb-4 sm:h-10 sm:w-10" />
					<p class="mb-3 text-xs text-gray-600 sm:mb-4 sm:text-sm">
						Drop a .zip project file here or select one to upload
					</p>
					<Button
						onclick={triggerFileInput}
						disabled={isProjectLoading}
						class="bg-blue-600 text-white hover:bg-blue-700"
					>
						{#if isProjectLoading}
							<LoadingIndicator operation="project-load" message="Loading project..." />
						{:else}
							<Upload class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
							<span class="text-xs sm:text-sm">Choose File</span>
						{/if}
					</Button>
					{#if projectLoadProgress?.progress !== undefined && projectLoadProgress.progress > 0}
						<div class="mt-3 w-full rounded-full bg-gray-200 sm:mt-4">
							<div
								class="h-1.5 rounded-full bg-blue-600 sm:h-2"
								style="width: {projectLoadProgress.progress}%"
							></div>
						</div>
						{#if projectLoadProgress.message}
							<p class="mt-1 text-xs text-gray-600 sm:mt-2">{projectLoadProgress.message}</p>
						{/if}
					{/if}
				</div>
				<p class="text-center text-xs text-gray-500">
					Note: Loading a project will refresh the page and start fresh.
				</p>
			</div>
		</DialogContent>
	</Dialog>

	<!-- Save Project Dialog -->
	<Dialog bind:open={saveDialogOpen}>
		<DialogTrigger>
			<Button
				variant="outline"
				size="sm"
				class="w-full border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:px-4"
			>
				<Download class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
				<span class="xs:inline hidden">Save Project</span>
				<span class="xs:hidden">Save</span>
			</Button>
		</DialogTrigger>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Save Project</DialogTitle>
				<DialogDescription>
					Download your project configuration and images as a ZIP file. You can load this file later
					to continue working.
				</DialogDescription>
			</DialogHeader>
			<div class="flex justify-end space-x-2">
				<Button
					variant="outline"
					onclick={() => (saveDialogOpen = false)}
					class="border-gray-300 text-gray-700 hover:bg-gray-100"
				>
					<span class="text-xs sm:text-sm">Cancel</span>
				</Button>
				<Button
					onclick={handleSaveProject}
					disabled={isProjectSaving}
					class="bg-blue-600 text-white hover:bg-blue-700"
				>
					{#if isProjectSaving}
						<LoadingIndicator operation="project-save" message="Saving project..." />
					{:else}
						<Save class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
						<span class="text-xs sm:text-sm">Save Project</span>
					{/if}
				</Button>
				{#if projectSaveProgress?.progress !== undefined && projectSaveProgress.progress > 0}
					<div class="mt-2 w-full rounded-full bg-gray-200">
						<div
							class="h-1.5 rounded-full bg-blue-600 sm:h-2"
							style="width: {projectSaveProgress.progress}%"
						></div>
					</div>
					{#if projectSaveProgress.message}
						<p class="mt-1 text-xs text-gray-600 sm:mt-2">{projectSaveProgress.message}</p>
					{/if}
				{/if}
			</div>
		</DialogContent>
	</Dialog>
</div>
