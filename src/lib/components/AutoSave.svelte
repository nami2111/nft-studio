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
			// Skip imageData from comparison to avoid unnecessary saves
			if (key === 'imageData') return undefined;
			return value;
		});

		if (projectString === lastSavedProject) {
			return; // No actual changes, skip save
		}

		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			try {
				const startTime = Date.now();
				STORAGE.save(project);
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
				// In a real implementation, you might show a toast notification to the user
				// import { toast } from 'svelte-sonner';
				// toast.error('Failed to save project. Please try again.');
			}
		}, 1000); // Debounce saves to prevent rapid consecutive storage operations
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
