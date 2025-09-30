<script lang="ts">
	import { project } from '$lib/stores';
	import { LocalStorageStore } from '$lib/persistence/storage';
	import type { Project } from '$lib/types/project';

	// Local storage key
	const PROJECT_STORAGE_KEY = 'nft-studio-project';
	const LOCAL_STORE = new LocalStorageStore<Project>(PROJECT_STORAGE_KEY);

	let saveTimeout: number | null = null;
	let lastSavedProject: string | null = null;

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
			LOCAL_STORE.save(project);
			lastSavedProject = projectString;
			saveTimeout = null;
		}, 500); // Increased debounce time to prevent rapid consecutive saves
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
