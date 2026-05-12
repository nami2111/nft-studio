import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import {
	generationState,
	resetState,
	cleanupGenerationState,
	addPreviews,
	startGeneration,
	completeGeneration
} from './generation-progress.svelte';

describe('generation state lifecycle', () => {
	beforeEach(() => {
		resetState();
	});

	it('resetState clears all accumulated data', () => {
		// Populate state with some data
		generationState.allImages = [{ name: 'test.png', imageData: new ArrayBuffer(4) }];
		generationState.allMetadata = [{ name: 'test.json', data: { attr: 'value' } }];
		generationState.error = 'some error';
		generationState.statusText = 'some status';

		resetState();

		expect(generationState.allImages).toEqual([]);
		expect(generationState.allMetadata).toEqual([]);
		expect(generationState.error).toBeNull();
		expect(generationState.statusText).toBe('Ready to generate');
		expect(generationState.isGenerating).toBe(false);
		expect(generationState.isPaused).toBe(false);
		expect(generationState.isBackground).toBe(false);
		expect(generationState.progress).toBe(0);
		expect(generationState.currentIndex).toBe(0);
		expect(generationState.totalItems).toBe(0);
		expect(generationState.startTime).toBeNull();
		expect(generationState.completionTime).toBeNull();
	});

	it('resetState clears preview array', () => {
		// Add a preview
		generationState.previews = [{ index: 0, url: 'blob:test-url' }];

		resetState();

		expect(generationState.previews).toEqual([]);
	});

	it('cleanupGenerationState is callable and resets state', () => {
		generationState.isGenerating = true;
		generationState.statusText = 'Generating...';

		cleanupGenerationState();

		expect(generationState.isGenerating).toBe(false);
		expect(generationState.statusText).toBe('Ready to generate');
	});

	it('startGeneration updates state correctly', () => {
		const sessionId = startGeneration({
			projectName: 'Test',
			projectDescription: 'Desc',
			outputSize: { width: 100, height: 100 },
			layers: [],
			collectionSize: 50,
			metadataStandard: 'ERC721'
		});

		expect(sessionId).toBeTruthy();
		expect(generationState.isGenerating).toBe(true);
		expect(generationState.totalItems).toBe(50);
		expect(generationState.statusText).toContain('Starting generation');
		expect(generationState.startTime).not.toBeNull();
		expect(generationState.sessionId).toBe(sessionId);
	});

	it('completeGeneration marks state as not generating', () => {
		startGeneration({
			projectName: 'Test',
			projectDescription: '',
			outputSize: { width: 100, height: 100 },
			layers: [],
			collectionSize: 10,
			metadataStandard: 'ERC721'
		});

		completeGeneration();

		expect(generationState.isGenerating).toBe(false);
		expect(generationState.isPaused).toBe(false);
		expect(generationState.completionTime).not.toBeNull();
		expect(generationState.progress).toBe(100);
	});
});
