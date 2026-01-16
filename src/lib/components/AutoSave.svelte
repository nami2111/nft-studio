<script lang="ts">
	import { project } from '$lib/stores';
	import { SmartStorageStore } from '$lib/persistence/storage';
	import type { Project } from '$lib/types/project';

	// Use smart storage that automatically chooses between localStorage and IndexedDB
	const PROJECT_STORAGE_KEY = 'nft-studio-project';
	const STORAGE = new SmartStorageStore<Project>(PROJECT_STORAGE_KEY);

	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastSavedHash: string | null = null;
	let lastSaveTime = $state<number | null>(null);
	let pendingChanges = $state(false);

	// Fields to exclude from persistence (large binary data)
	const EXCLUDED_FIELDS = ['imageData', 'imageUrl', '_needsProperLoad'];

	// Compute a fast hash of the project state for change detection
	function computeProjectHash(projectState: Project): string {
		const hashParts: string[] = [];

		// Include key structural elements that indicate meaningful changes
		if (projectState.layers) {
			hashParts.push(`layers:${projectState.layers.length}`);
			for (const layer of projectState.layers) {
				hashParts.push(`layer:${layer.id}:${layer.name}:${layer.traits.length}`);
			}
		}

		if (projectState.outputSize) {
			hashParts.push(`size:${projectState.outputSize.width}:${projectState.outputSize.height}`);
		}

		if (projectState.name) {
			hashParts.push(`name:${projectState.name}`);
		}

		if (projectState.description) {
			hashParts.push(`desc:${projectState.description.substring(0, 100)}`);
		}

		// Use a simple hash function
		let hash = 0;
		const str = hashParts.join('|');
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return hash.toString(36);
	}

	// Create a compact version of the project for storage
	function createCompactProject(projectState: Project): Project {
		const compact: Project = {
			id: projectState.id,
			name: projectState.name,
			description: projectState.description,
			outputSize: projectState.outputSize,
			layers:
				projectState.layers?.map((layer) => ({
					id: layer.id,
					name: layer.name,
					order: layer.order,
					isOptional: layer.isOptional,
					traits: layer.traits.map((trait) => ({
						id: trait.id,
						name: trait.name,
						rarityWeight: trait.rarityWeight,
						type: trait.type,
						rulerRules: trait.rulerRules,
						// Include empty imageData to satisfy type requirements
						// This will be cleaned by SmartStorageStore.cleanForSerialization
						imageData: new ArrayBuffer(0)
					}))
				})) || [],
			metadataStandard: projectState.metadataStandard,
			strictPairConfig: projectState.strictPairConfig,
			_needsProperLoad: false
		};
		return compact;
	}

	// Use $effect to watch for project changes and auto-save
	$effect(() => {
		// Skip if project has no layers (empty project)
		if (!project.layers || project.layers.length === 0) {
			return;
		}

		// Compute hash of current project state
		const currentHash = computeProjectHash(project);

		// Skip if no actual changes
		if (currentHash === lastSavedHash) {
			return;
		}

		pendingChanges = true;

		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			try {
				const startTime = Date.now();

				// Create compact version for storage
				const compactProject = createCompactProject(project);

				STORAGE.save(compactProject);
				const saveDuration = Date.now() - startTime;

				lastSavedHash = currentHash;
				lastSaveTime = Date.now();
				saveTimeout = null;
				pendingChanges = false;

				// Log performance for large projects
				if (saveDuration > 500) {
					console.info(
						`AutoSave completed in ${saveDuration}ms (compact mode, ${pendingChanges ? 'with pending changes' : 'up to date'})`
					);
				}
			} catch (error) {
				console.error('AutoSave failed:', error);
				pendingChanges = true;
			}
		}, 2000); // Debounce time to prevent rapid saves
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
