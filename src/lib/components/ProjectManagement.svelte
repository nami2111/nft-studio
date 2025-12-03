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
		updateDetailedLoading,
		stopDetailedLoading,
		startLoading,
		stopLoading
	} from '$lib/stores';
	import JSZip from 'jszip';
	import type { Project, Layer, Trait } from '$lib/types/project';
	import { validateImportedProject } from '$lib/domain';
	import { generateLayerId, generateTraitId } from '$lib/types/ids';
	import { globalResourceManager } from '$lib/stores/resource-manager';
	import FolderOpen from 'lucide-svelte/icons/folder-open';
	import Save from 'lucide-svelte/icons/save';
	import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
	import Upload from 'lucide-svelte/icons/upload';
	import Download from 'lucide-svelte/icons/download';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import { Modal } from '$lib/components/ui/modal';

	let loadDialogOpen = $state(false);
	let saveDialogOpen = $state(false);
	let loadFileInputElement: HTMLInputElement | null = null;
	let saveFileInputElement: HTMLInputElement | null = null;
	let isDragOver = $state(false);
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

	// Enhanced file validation for drag and drop
	function validateDroppedFiles(files: FileList): { isValid: boolean; file?: File; error?: string } {
		if (!files || files.length === 0) {
			return { isValid: false, error: 'No files dropped' };
		}

		const file = files[0];
		
		if (!file.name.toLowerCase().endsWith('.zip')) {
			return { isValid: false, error: 'Please drop a .zip project file' };
		}

		// Special handling for drag and drop files that may report size as 0
		// We'll skip size validation and let the FileReader determine actual file size
		if (file.size === 0) {
			// Don't return error here - let the FileReader handle the actual file reading
		} else if (file.size > 200 * 1024 * 1024) {
			return { 
				isValid: false, 
				error: `File "${file.name}" is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 200MB.` 
			};
		}

		return { isValid: true, file };
	}

	// Specialized file reading for drag and drop with different approach
	async function readDragDropFile(file: File): Promise<ArrayBuffer> {
		// For drag and drop files, we need to handle them differently
		// Some browsers report file.size as 0 initially for drag and drop
		// So we try to read the file immediately to get the actual size
		
		console.log('[readDragDropFile] Starting to read file:', {
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified
		});
		
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			
			reader.onload = (event) => {
				const result = event.target?.result;
				console.log('[readDragDropFile] FileReader onload:', {
					resultType: typeof result,
					isArrayBuffer: result instanceof ArrayBuffer,
				 byteLength: result instanceof ArrayBuffer ? result.byteLength : 'N/A'
				});
				
				if (result instanceof ArrayBuffer) {
					if (result.byteLength === 0) {
						console.error('[readDragDropFile] File read successfully but is empty (0 bytes)');
						reject(new Error(`File "${file.name}" is empty (0 bytes). The file may be corrupted or incomplete.`));
						return;
					}
					
					console.log(`[readDragDropFile] Successfully read dragged file: ${file.name} (${result.byteLength} bytes)`);
					resolve(result);
				} else {
					console.error('[readDragDropFile] Invalid result type:', typeof result, result);
					reject(new Error(`Failed to read file ${file.name}: invalid result type (${typeof result})`));
				}
			};
			
			reader.onerror = () => {
				console.error(`[readDragDropFile] Error reading dragged file: ${file.name}`, reader.error);
				reject(new Error(`Failed to read dragged file "${file.name}": ${reader.error?.message || 'Unknown error'}`));
			};
			
			reader.onabort = () => {
				console.log(`[readDragDropFile] Reading aborted for file: ${file.name}`);
				reject(new Error(`Reading dragged file "${file.name}" was aborted`));
			};
			
			try {
				console.log('[readDragDropFile] Starting FileReader.readAsArrayBuffer...');
				// Use readAsArrayBuffer directly for drag and drop
				reader.readAsArrayBuffer(file);
			} catch (error) {
				console.error('[readDragDropFile] Exception starting file read:', error);
				reject(new Error(`Failed to start reading dragged file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`));
			}
		});
	}

	// Enhanced drag and drop file loading with different strategy
	async function handleDragDropFileLoad(file: File): Promise<Project> {
		console.log(`[handleDragDropFileLoad] Processing dragged file: ${file.name} (reported size: ${file.size} bytes)`);
		
		try {
			// For drag and drop, use the specialized reader
			console.log('[handleDragDropFileLoad] About to call readDragDropFile...');
			const arrayBuffer = await readDragDropFile(file);
			console.log('[handleDragDropFileLoad] File read successfully, parsing ZIP...');
			
			const zip = await JSZip.loadAsync(arrayBuffer);
			console.log('[handleDragDropFileLoad] ZIP loaded successfully');

			// Check if project.json exists
			const projectFile = zip.file('project.json');
			if (!projectFile) {
				throw new Error(
					`Invalid project file: "project.json" not found in ${file.name}. ` +
					`This file may be corrupted or is not a valid NFT Studio project file.`
				);
			}

			// Parse project data
			console.log('[handleDragDropFileLoad] Parsing project.json...');
			const projectData = JSON.parse(await projectFile.async('text'));
			console.log('[handleDragDropFileLoad] Project data parsed successfully');

			// Validate imported project
			const validationResult = validateImportedProject(projectData);
			if (!validationResult.success) {
				throw new Error(
					`Invalid project structure in ${file.name}: ${validationResult.error}`
				);
			}

			// Process the stored project data and load trait images
			const storedProject = validationResult.data as Project;
			const originalLayerIds = new Map<string, string>();
			const originalTraitIds = new Map<string, string>();

			// Track original IDs for migration
			storedProject.layers.forEach((layer: Layer) => {
				originalLayerIds.set(layer.id, layer.id);
				layer.traits.forEach((trait: Trait) => {
					originalTraitIds.set(trait.id, trait.id);
				});
			});

			// Generate new IDs to avoid conflicts
			const newLayerIds = new Map<string, string>();
			const newTraitIds = new Map<string, string>();

			storedProject.layers.forEach((layer: Layer) => {
				const newLayerId = generateLayerId();
				newLayerIds.set(layer.id, newLayerId);
				layer.id = newLayerId;

				layer.traits.forEach((trait: Trait) => {
					const newTraitId = generateTraitId();
					newTraitIds.set(trait.id, newTraitId);
					trait.id = newTraitId;
				});
			});

			// Load trait images from ZIP
			const imageLoadPromises: Promise<void>[] = [];

			for (const layer of storedProject.layers) {
				for (const trait of layer.traits) {
					const imagePath = `images/${originalLayerIds.get(layer.id)}/${originalTraitIds.get(trait.id)}.png`;
					const imageFile = zip.file(imagePath);

					if (imageFile) {
						const loadPromise = imageFile.async('arraybuffer').then((arrayBuffer) => {
							trait.imageData = arrayBuffer;
							// Create object URL for preview
							const blob = new Blob([arrayBuffer], { type: 'image/png' });
							trait.imageUrl = URL.createObjectURL(blob);
							globalResourceManager.addObjectUrl(trait.imageUrl);
						}).catch((error) => {
							console.warn(`Failed to load image for trait "${trait.name}":`, error);
							// Remove the trait if loading fails
							const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
							if (traitIndex !== -1) {
								layer.traits.splice(traitIndex, 1);
							}
						});

						imageLoadPromises.push(loadPromise);
					}
				}
			}

			// Wait for all images to load
			await Promise.all(imageLoadPromises);

			console.log(`[handleDragDropFileLoad] Successfully loaded project: ${storedProject.name}`);
			return storedProject;
		} catch (error) {
			console.error(`[handleDragDropFileLoad] Error loading dragged project:`, error);
			throw error;
		}
	}

	async function handleLoadProject(files: FileList | null) {
		if (!files || files.length === 0) {
			toast.error('Please select a valid .zip project file');
			return;
		}

		const validation = validateDroppedFiles(files);
		if (!validation.isValid) {
			toast.error(validation.error || 'Invalid file selected');
			return;
		}

		const file = validation.file!;

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
			updateDetailedLoading('project-load', 10, `Reading file: ${file.name}`);
			
			await loadProjectFromZip(file);
			
			updateDetailedLoading('project-load', 100, 'Project loaded successfully');
			markProjectAsLoaded();
			toast.success('Project loaded successfully!');
			loadDialogOpen = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load project';
			
			// Provide helpful guidance based on error type
			if (message.includes('NotFoundError') || message.includes('could not be found')) {
				toast.error(
					`File access error: ${message} Try using the file browser instead of drag and drop.`
				);
			} else if (message.includes('SecurityError') || message.includes('security')) {
				toast.error(
					`Security error: ${message} Please try using the file browser instead of drag and drop.`
				);
			} else if (message.includes('Invalid project file') || message.includes('corrupted')) {
				toast.error(message);
			} else {
				toast.error(`Failed to load project: ${message}`);
			}
		} finally {
			// Reset file input
			if (loadFileInputElement) {
				loadFileInputElement.value = '';
			}
			stopDetailedLoading('project-load');
			stopLoading('project-load');
		}
	}

	// Handle drag and drop with enhanced validation
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		// Only reset if we're leaving the drop zone entirely
		const currentTarget = event.currentTarget as HTMLElement;
		const relatedTarget = event.relatedTarget as Node;
		if (currentTarget && !currentTarget.contains(relatedTarget)) {
			isDragOver = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		
		if (!event.dataTransfer || !event.dataTransfer.files) {
			toast.error('No files detected in drop operation');
			return;
		}

		const validation = validateDroppedFiles(event.dataTransfer.files);
		
		if (!validation.isValid) {
			toast.error(validation.error || 'Invalid file dropped');
			return;
		}

		const file = validation.file!;
		readFileImmediately(file);
	}

	// Read file immediately to avoid file handle issues
	function readFileImmediately(file: File) {
		const reader = new FileReader();
		
		reader.onload = (event) => {
			const result = event.target?.result;
			
			if (result instanceof ArrayBuffer) {
				if (result.byteLength === 0) {
					toast.error(`File "${file.name}" is empty. The file may be corrupted.`);
					return;
				}
				
				processArrayBuffer(file, result);
			} else {
				toast.error(`Failed to read file "${file.name}": invalid result`);
			}
		};
		
		reader.onerror = () => {
			if (reader.error?.name === 'NotFoundError' || 
				reader.error?.message?.includes('could not be found') ||
				reader.error?.message?.includes('NotFoundError')) {
				
				toast.error(
					`Cannot access file "${file.name}" via drag and drop. ` +
					`This is a browser security restriction for files dragged from external sources. ` +
					`Please use the "Choose File" button instead.`,
					{
						duration: 6000, // Show longer for important message
					}
				);
			} else if (reader.error?.name === 'SecurityError' || 
					   reader.error?.message?.includes('security')) {
				toast.error(
					`Security error accessing file "${file.name}". ` +
					`Please try using the file browser instead of drag and drop.`,
					{
						duration: 6000,
					}
				);
			} else {
				toast.error(`Failed to read file "${file.name}": ${reader.error?.message || 'Unknown error'}. Try using the file browser instead.`);
			}
		};
		
		reader.onabort = () => {
			toast.error(`Reading file "${file.name}" was aborted`);
		};
		
		try {
			reader.readAsArrayBuffer(file);
		} catch (error) {
			toast.error(`Failed to read file "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Process the ArrayBuffer directly without file references
	function processArrayBuffer(originalFile: File, arrayBuffer: ArrayBuffer) {
		// Warn about unsaved changes before loading
		if (hasUnsavedChanges) {
			const proceed = confirm(
				'Loading a new project will discard current unsaved changes. Proceed?'
			);
			if (!proceed) return;
		}

		startLoading('project-load');
		startDetailedLoading('project-load', 100);
		updateDetailedLoading('project-load', 20, `Processing file: ${originalFile.name}`);
		
		// Use the ArrayBuffer directly without file references
		processZipFromArrayBuffer(originalFile.name, arrayBuffer);
	}

	// Process ZIP from ArrayBuffer without file dependencies
	async function processZipFromArrayBuffer(fileName: string, arrayBuffer: ArrayBuffer) {
		try {
			const zip = await JSZip.loadAsync(arrayBuffer);

			// Check if project.json exists
			const projectFile = zip.file('project.json');
			if (!projectFile) {
				throw new Error(
					`Invalid project file: "project.json" not found in ${fileName}. ` +
					`This file may be corrupted or is not a valid NFT Studio project file.`
				);
			}

			// Parse project data
			const projectData = JSON.parse(await projectFile.async('text'));

			// Validate imported project
			const validationResult = validateImportedProject(projectData);
			if (!validationResult.success) {
				throw new Error(
					`Invalid project structure in ${fileName}: ${validationResult.error}`
				);
			}

			// Process the stored project data and load trait images
			const storedProject = validationResult.data as Project;
			
			// Generate new IDs to avoid conflicts
			storedProject.layers.forEach((layer: Layer) => {
				const newLayerId = generateLayerId();
				layer.id = newLayerId;

				layer.traits.forEach((trait: Trait) => {
					const newTraitId = generateTraitId();
					trait.id = newTraitId;
				});
			});

			// Load trait images from ZIP
			const imageLoadPromises: Promise<void>[] = [];

			for (const layer of storedProject.layers) {
				for (const trait of layer.traits) {
					// Generate expected image path (using original layer/trait IDs from project data)
					const imagePath = `images/${layer.id}/${trait.id}.png`;
					const imageFile = zip.file(imagePath);

					if (imageFile) {
						const loadPromise = imageFile.async('arraybuffer').then((traitArrayBuffer) => {
							trait.imageData = traitArrayBuffer;
							// Create object URL for preview
							const blob = new Blob([traitArrayBuffer], { type: 'image/png' });
							trait.imageUrl = URL.createObjectURL(blob);
							globalResourceManager.addObjectUrl(trait.imageUrl);
						}).catch((error) => {
							// Remove the trait if loading fails
							const traitIndex = layer.traits.findIndex((t: Trait) => t.id === trait.id);
							if (traitIndex !== -1) {
								layer.traits.splice(traitIndex, 1);
							}
						});

						imageLoadPromises.push(loadPromise);
					}
				}
			}

			// Wait for all images to load
			await Promise.all(imageLoadPromises);
			
			updateDetailedLoading('project-load', 100, 'Project loaded successfully');
			
			// Update project state
			project.id = storedProject.id;
			project.name = storedProject.name;
			project.description = storedProject.description || '';
			project.outputSize = storedProject.outputSize || { width: 0, height: 0 };
			project.layers = storedProject.layers;
			project._needsProperLoad = false;
			
			markProjectAsLoaded();
			toast.success('Project loaded successfully!');
			loadDialogOpen = false;
			
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to process project file';
			toast.error(`Failed to load project: ${message}`);
		} finally {
			stopDetailedLoading('project-load');
			stopLoading('project-load');
		}
	}

	// Specialized handler for drag and drop file loading
	async function handleDragDropLoad(file: File) {
		console.log('[handleDragDropLoad] Starting drag drop load for:', file.name);
		
		try {
			startLoading('project-load');
			startDetailedLoading('project-load', 100);
			updateDetailedLoading('project-load', 10, `Reading dragged file: ${file.name}`);
			
			console.log('[handleDragDropLoad] About to call handleDragDropFileLoad...');
			const loadedProject = await handleDragDropFileLoad(file);
			console.log('[handleDragDropLoad] Successfully loaded project:', loadedProject.name);
			
			updateDetailedLoading('project-load', 100, 'Project loaded successfully');
			markProjectAsLoaded();
			toast.success('Project loaded successfully!');
			loadDialogOpen = false;
		} catch (error) {
			console.error('[handleDragDropLoad] Error during drag drop load:', error);
			const message = error instanceof Error ? error.message : 'Failed to load project';
			
			// Provide helpful guidance based on error type
			if (message.includes('NotFoundError') || message.includes('could not be found')) {
				toast.error(
					`File access error: ${message} Try using the file browser instead of drag and drop.`
				);
			} else if (message.includes('SecurityError') || message.includes('security')) {
				toast.error(
					`Security error: ${message} Please try using the file browser instead of drag and drop.`
				);
			} else if (message.includes('Invalid project file') || message.includes('corrupted')) {
				toast.error(message);
			} else {
				toast.error(`Failed to load dragged project: ${message}`);
			}
		} finally {
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
	<Button
		variant="outline"
		size="sm"
		class="w-full sm:w-auto"
		onclick={() => (loadDialogOpen = true)}
	>
		<Upload class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
		<span class="xs:inline hidden">Load Project</span>
		<span class="xs:hidden">Load</span>
	</Button>

	<!-- Load Project Modal -->
	<Modal bind:open={loadDialogOpen} title="Load Project" onClose={() => (loadDialogOpen = false)}>
		<p class="text-muted-foreground mb-4">
			Upload a previously saved project ZIP file to restore your configuration and images.
		</p>
		<div class="space-y-3 sm:space-y-4">
			<div
				class="border-input hover:border-primary hover:border-muted-foreground/20 rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-6 {isProjectLoading
					? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500'
					: isDragOver
					? 'border-green-500 bg-green-50 ring-2 ring-green-400'
					: ''}"
				role="button"
				tabindex="0"
				ondragover={handleDragOver}
				ondragenter={handleDragEnter}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
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
				💡 <strong>Tip:</strong> For the best results, try using the "Choose File" button if drag and drop doesn't work.
			</p>
			<p class="text-muted-foreground text-center text-xs">
				Note: Loading a project will refresh the page and start fresh.
			</p>
		</div>
	</Modal>

	<!-- Save Project Button -->
	<Button
		variant="outline"
		size="sm"
		class="w-full sm:w-auto"
		onclick={() => (saveDialogOpen = true)}
	>
		<Download class="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
		<span class="xs:inline hidden">Save Project</span>
		<span class="xs:hidden">Save</span>
	</Button>

	<!-- Save Project Modal -->
	<Modal bind:open={saveDialogOpen} title="Save Project" onClose={() => (saveDialogOpen = false)}>
		<p class="text-muted-foreground mb-4">
			Download your project configuration and images as a ZIP file. You can load this file later to
			continue working.
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
