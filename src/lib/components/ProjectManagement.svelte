<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';
	import {
		loadProjectFromZip,
		saveProjectToZip,
		project,
		loadingStates,
		projectNeedsZipLoad,
		markProjectAsLoaded
	} from '$lib/stores/runes-store';
	import { get } from 'svelte/store';
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
	let isProjectLoading = $derived(loadingStates['project-load']);
	let isProjectSaving = $derived(loadingStates['project-save']);

	// Track unsaved changes
	let hasUnsavedChanges = $derived(
		$project.layers.length > 0 || $project.name.trim() !== '' || $project.description.trim() !== ''
	);

	function triggerFileInput() {
		if (loadFileInputElement) {
			loadFileInputElement.click();
		}
	}

	async function confirmAndSave() {
		if (!hasUnsavedChanges) return true;
		const confirmed = confirm('You have unsaved changes. Do you want to save before proceeding?');
		if (confirmed) {
			try {
				await saveProjectToZip();
				toast.success('Project saved successfully!');
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Failed to save project');
				return false;
			}
		}
		return true;
	}

	async function handleSaveProject() {
		try {
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
			const success = await loadProjectFromZip(file);
			if (success) {
				markProjectAsLoaded();
				toast.success('Project loaded successfully!');
				loadDialogOpen = false;
			} else {
				toast.error('Failed to load project. Please check the file format.');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load project';
			toast.error(message);
		} finally {
			// Reset file input
			if (loadFileInputElement) {
				loadFileInputElement.value = '';
			}
		}
	}
</script>

<div class="flex space-x-3">
	{#if projectNeedsZipLoad()}
		<Card class="mb-2 border border-yellow-200 bg-yellow-50 p-2 text-sm">
			<CardContent class="flex items-center p-0">
				<AlertTriangle class="mr-2 h-4 w-4 text-yellow-600" />
				<p class="text-yellow-800">Don't forget to save your Project first before generate.</p>
			</CardContent>
		</Card>
	{/if}

	<!-- Load Project Dialog -->
	<Dialog bind:open={loadDialogOpen}>
		<DialogTrigger>
			<Button
				variant="outline"
				class="border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
			>
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
				<div
					class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500 hover:border-gray-400"
					role="button"
					tabindex="0"
					ondragover={(e) => {
						e.preventDefault();
						e.dataTransfer.dropEffect = 'copy';
					}}
					ondragenter={(e) => e.preventDefault()}
					ondragleave={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						const files = e.dataTransfer.files;
						handleLoadProject(files);
					}}
				>
					<input
						bind:this={loadFileInputElement}
						type="file"
						accept=".zip"
						class="hidden"
						onchange={(e) => handleLoadProject((e.target as HTMLInputElement).files)}
					/>
					<FolderOpen class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<p class="mb-4 text-sm text-gray-600">
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

	<!-- Save Project Dialog -->
	<Dialog bind:open={saveDialogOpen}>
		<DialogTrigger>
			<Button
				variant="outline"
				class="border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
			>
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
				<Button
					variant="outline"
					onclick={() => (saveDialogOpen = false)}
					class="border-gray-300 text-gray-700 hover:bg-gray-100">Cancel</Button
				>
				<Button
					onclick={handleSaveProject}
					disabled={isProjectSaving}
					class="bg-blue-600 text-white hover:bg-blue-700"
				>
					{#if isProjectSaving}
						<LoadingIndicator operation="project-save" message="Saving project..." />
					{:else}
						<Save class="mr-2 h-4 w-4" />
						Save Project
					{/if}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
</div>
