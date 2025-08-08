<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import {
		saveProjectToZip,
		loadProjectFromZip,
		markProjectAsLoaded,
		projectNeedsZipLoad
	} from '$lib/stores/project.store';
	import { toast } from 'svelte-sonner';
	import { Download, Upload, FolderOpen, AlertTriangle } from 'lucide-svelte';

	let saveDialogOpen = $state(false);
	let loadDialogOpen = $state(false);
	let loadFileInputElement: HTMLInputElement | undefined;
	let isLoading = $state(false);

	async function handleSaveProject() {
		try {
			await saveProjectToZip();
			toast.success('Project saved successfully!');
			saveDialogOpen = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to save project';
			toast.error(message);
		}
	}

	async function handleLoadProject(files: FileList | null) {
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.name.endsWith('.zip')) {
			toast.error('Please select a valid .zip project file');
			return;
		}

		isLoading = true;
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
			isLoading = false;
			// Reset file input
			if (loadFileInputElement) {
				loadFileInputElement.value = '';
			}
		}
	}

	function triggerFileInput() {
		if (loadFileInputElement) {
			loadFileInputElement.click();
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
				<Button onclick={handleSaveProject}>
					<Download class="mr-2 h-4 w-4" />
					Download Project
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
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							/>
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
