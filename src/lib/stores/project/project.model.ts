import type { Project } from '$lib/types/project';

// Load project from storage asynchronously; start with a default and then hydrate
export function defaultProject(): Project {
	return {
		id: crypto.randomUUID(),
		name: 'My NFT Collection',
		description: 'A collection of unique NFTs',
		outputSize: {
			width: 0, // Will be set by first uploaded image
			height: 0 // Will be set by first uploaded image
		},
		layers: []
	};
}
