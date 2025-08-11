<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { loadProjectFromZip, saveProjectToZip, project } from '$lib/stores/project/project.store';
	import { get } from 'svelte/store';
	import { loadingStore } from '$lib/stores/loading.store';
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
	let isLoading = $derived(loadingStore.isLoading('project-load'));
	let isSaving = $derived(loadingStore.isLoading('project-save'));

	// Check if project needs to be loaded from ZIP (indicated by the special flag)
	function projectNeedsZipLoad(): boolean {
		const currentProject = get(project);
		return !!currentProject._needsProperLoad;
	}

	// Mark project as properly loaded (remove the special flag)
	function markProjectAsLoaded(): void {
		// This function is not available in the project store
		// We'll need to implement this functionality differently
		// For now, we'll just update the project to remove the _needsProperLoad flag
		project.update((currentProject) => {
			const updatedProject = { ...currentProject };
			delete updatedProject._needsProperLoad;
			return updatedProject;
		});
	}

	function triggerFileInput() {
		if (loadFileInputElement) {
			loadFileInputElement.click();
		}
	}

	async function handleSaveProject() {
		loadingStore.start('project-save');
		try {
			await saveProjectToZip();
			toast.success('Project saved successfully!');
			saveDialogOpen = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to save project';
			toast.error(message);
		} finally {
			loadingStore.stop('project-save');
			// Reset file input
			if (saveFileInputElement) {
				saveFileInputElement.value = '';
			}
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

		loadingStore.start('project-load');
		try {
			const success = await loadProjectFromZip(file);
			if (success) {
				// Mark project as properly loaded
				markProjectAsLoaded();
				toast.success('Project loaded successfully!');
				loadDialogOpen = false;
				// Refresh the page to start fresh
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} else {
				toast.error('Failed to load project. Please check the file format.');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load project';
			toast.error(message);
		} finally {
			loadingStore.stop('project-load');
			// Reset file input
			if (loadFileInputElement) {
				loadFileInputElement.value = '';
			}
		}
	}
</script>

{#if projectNeedsZipLoad()}
	<div class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
		<div class="flex items-center">
			<AlertTriangle class="mr-2 h-5 w-5 text-yellow-600" />
			<p class="text-yellow-800">
				Please load a project file to start generating, or create a new project and save it first.
			</p>
		</div>
	</div>
{/if}

<div class="flex space-x-2">
	<!-- Save Project Dialog -->
	<Dialog bind:open={saveDialogOpen}>
		<DialogTrigger>
			<Button variant="outline">
				<Download class="mr-2 h-4 w-4" />
				Save Project
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
				<Button variant="outline" onclick={() => (saveDialogOpen = false)}>Cancel</Button>
				<Button onclick={handleSaveProject} disabled={isSaving}>
					{#if isSaving}
						<LoadingIndicator operation="project-save" message="Saving project..." />
					{:else}
						<Save class="mr-2 h-4 w-4" />
						Save Project
					{/if}
				</Button>
			</div>
		</DialogContent>
	</Dialog>

	<!-- Load Project Dialog -->
	<Dialog bind:open={loadDialogOpen}>
		<DialogTrigger>
			<Button variant="outline">
				<Upload class="mr-2 h-4 w-4" />
				Load Project
			</Button>
		</DialogTrigger>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Load Project</DialogTitle>
				<DialogDescription>
					Upload a previously saved project ZIP file to restore your configuration and images.
				</DialogDescription>
			</DialogHeader>
			<div class="space-y-4">
				<div class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
					<input
						bind:this={loadFileInputElement}
						type="file"
						accept=".zip"
						class="hidden"
						onchange={(e) => handleLoadProject((e.target as HTMLInputElement).files)}
					/>
					<FolderOpen class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<p class="mb-4 text-sm text-gray-600">Select a .zip project file to upload</p>
					<Button onclick={triggerFileInput} disabled={isLoading}>
						{#if isLoading}
							<LoadingIndicator operation="project-load" message="Loading project..." />
						{:else}
							<Upload class="mr-2 h-4 w-4" />
							Choose File
						{/if}
					</Button>
				</div>
				<p class="text-center text-xs text-gray-500">
					Note: Loading a project will refresh the page and start fresh.
				</p>
			</div>
		</DialogContent>
	</Dialog>
</div>
