<script lang="ts">
	import { project } from '$lib/stores';
	import { SmartStorageStore } from '$lib/persistence/storage';
	import type { Project } from '$lib/types/project';

	// Use smart storage that automatically chooses between localStorage and IndexedDB
	const PROJECT_STORAGE_KEY = 'nft-studio-project';
	const STORAGE = new SmartStorageStore<Project>(PROJECT_STORAGE_KEY);

	let saveTimeout: number | null = null;
	let lastSavedProject: string | null = null;
	let lastSaveTime = $state<number | null>(null);

	// Use $effect to watch for project changes and auto-save
	$effect(() => {
		// Only save if the project has actually changed
		const projectString = JSON.stringify(project, (key, value) => {
			// Skip imageData, imageUrl, and internal state from comparison to avoid unnecessary saves
			if (key === 'imageData' || key === 'imageUrl' || key === '_needsProperLoad') return undefined;
			return value;
		});

		if (projectString === lastSavedProject) {
			return; // No actual changes, skip save
		}

		// Skip auto-save if project has no layers (empty project)
		if (!project.layers || project.layers.length === 0) {
			lastSavedProject = projectString;
			return;
		}

		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			try {
				const startTime = Date.now();

				// Create a compact version of the project for storage (remove image data)
				const compactProject = JSON.parse(
					JSON.stringify(project, (key, value) => {
						// Remove image data and URLs to prevent storage quota issues
						if (key === 'imageData' || key === 'imageUrl' || key === '_needsProperLoad')
							return undefined;
						return value;
					})
				);

				STORAGE.save(compactProject);
				const saveDuration = Date.now() - startTime;

				lastSavedProject = projectString;
				lastSaveTime = Date.now();
				saveTimeout = null;

				// Log performance for large projects
				if (saveDuration > 1000) {
					// More than 1 second
					console.info(
						`AutoSave completed in ${saveDuration}ms (${Math.round(new Blob([projectString]).size / 1024)}KB)`
					);
				}
			} catch (error) {
				console.error('AutoSave failed:', error);
				// Prevent unhandled promise rejection by catching and handling the error properly
				// In a real implementation, you might show a toast notification to the user
				// import { toast } from 'svelte-sonner';
				// toast.error('Failed to save project. Please try again.');
			}
		}, 2000); // Increased debounce time to 2 seconds to prevent rapid saves
	});

	// Cleanup on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
	});
</script>

<!-- This component handles auto-saving and renders nothing -->
