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
		stopDetailedLoading,
		startLoading,
		stopLoading
	} from '$lib/stores';
	import { FolderOpen, Save, AlertTriangle, Upload, Download } from 'lucide-svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import { Modal } from '$lib/components/ui/modal';

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
			const zipData = await saveProjectToZip();

			// Trigger download
			const blob = new Blob([zipData], { type: 'application/zip' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${project.name || 'nft-project'}.zip`;
			document.body.appendChild(a);
			try {
				a.click();
				console.log('Project download initiated for:', a.download);
			} catch (error) {
				console.error('Download failed:', error);
				throw error;
			} finally {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}

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
			startLoading('project-load');
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
			stopLoading('project-load');
		}
	}
</script>

<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
	{#if projectNeedsZipLoad()}
		<Card class="border-border bg-muted mb-2 inline-flex border p-2 text-xs sm:text-sm">
			<CardContent class="flex items-center gap-2 p-0">
				<AlertTriangle class="text-muted-foreground h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
				<span class="text-foreground">Don't forget to save your Project first before generate.</span
				>
			</CardContent>
		</Card>
	{/if}

	<!-- Load Project Button -->
	<Button variant="outline" size="sm" class="w-full sm:w-auto" onclick={() => (loadDialogOpen = true)}>
		<Upload class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
		<span class="xs:inline hidden">Load Project</span>
		<span class="xs:hidden">Load</span>
	</Button>

	<!-- Load Project Modal -->
	<Modal
		bind:open={loadDialogOpen}
		title="Load Project"
		onClose={() => (loadDialogOpen = false)}
	>
			<p class="text-muted-foreground mb-4">
				Upload a previously saved project ZIP file to restore your configuration and images.
			</p>
			<div class="space-y-3 sm:space-y-4">
				<div
					class="border-input hover:border-primary hover:border-muted-foreground/20 rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-6 {isProjectLoading
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
					<FolderOpen class="text-muted-foreground mx-auto mb-3 h-8 w-8 sm:mb-4 sm:h-10 sm:w-10" />
					<p class="text-muted-foreground mb-3 text-xs sm:mb-4 sm:text-sm">
						Drop a .zip project file here or select one to upload
					</p>
					<Button
						onclick={triggerFileInput}
						disabled={isProjectLoading}
						class="transition-all disabled:hover:scale-100"
					>
						{#if isProjectLoading}
							<LoadingIndicator operation="project-load" message="Loading project..." />
						{:else}
							<Upload class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
							<span class="text-xs sm:text-sm">Choose File</span>
						{/if}
					</Button>
					{#if projectLoadProgress?.progress !== undefined && projectLoadProgress.progress > 0}
						<div class="bg-muted mt-3 w-full rounded-full sm:mt-4">
							<div
								class="h-1.5 rounded-full bg-blue-600 sm:h-2"
								style="width: {projectLoadProgress.progress}%"
							></div>
						</div>
						{#if projectLoadProgress.message}
							<p class="text-muted-foreground mt-1 text-xs sm:mt-2">
								{projectLoadProgress.message}
							</p>
						{/if}
					{/if}
				</div>
				<p class="text-muted-foreground text-center text-xs">
					Note: Loading a project will refresh the page and start fresh.
				</p>
			</div>
	</Modal>

	<!-- Save Project Button -->
	<Button variant="outline" size="sm" class="w-full sm:w-auto" onclick={() => (saveDialogOpen = true)}>
		<Download class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
		<span class="xs:inline hidden">Save Project</span>
		<span class="xs:hidden">Save</span>
	</Button>

	<!-- Save Project Modal -->
	<Modal
		bind:open={saveDialogOpen}
		title="Save Project"
		onClose={() => (saveDialogOpen = false)}
	>
		<p class="text-muted-foreground mb-4">
			Download your project configuration and images as a ZIP file. You can load this file later
			to continue working.
		</p>
			<div class="flex justify-end space-x-2">
				<Button variant="outline" onclick={() => (saveDialogOpen = false)}>
					<span class="text-xs sm:text-sm">Cancel</span>
				</Button>
				<Button
					onclick={handleSaveProject}
					disabled={isProjectSaving}
					class="transition-all disabled:hover:scale-100"
				>
					{#if isProjectSaving}
						<LoadingIndicator operation="project-save" message="Saving project..." />
					{:else}
						<Save class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
						<span class="text-xs sm:text-sm">Save Project</span>
					{/if}
				</Button>
				{#if projectSaveProgress?.progress !== undefined && projectSaveProgress.progress > 0}
					<div class="bg-muted mt-2 w-full rounded-full">
						<div
							class="h-1.5 rounded-full bg-blue-600 sm:h-2"
							style="width: {projectSaveProgress.progress}%"
						></div>
					</div>
					{#if projectSaveProgress.message}
						<p class="text-muted-foreground mt-1 text-xs sm:mt-2">{projectSaveProgress.message}</p>
					{/if}
				{/if}
			</div>
	</Modal>
</div>
