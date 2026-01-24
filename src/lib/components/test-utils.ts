/**
 * Test utilities for component testing.
 * Provides helper functions and mock data.
 */

import { render, RenderResult } from '@testing-library/svelte';
import type { Project, Layer, Trait } from '$lib/types';
import type { SvelteComponent } from 'svelte';

/**
 * Mock project data for testing
 */
export const mockProject: Project = {
	id: 'test-project-1',
	name: 'Test Project',
	description: 'A test project for unit testing',
	outputSize: { width: 1000, height: 1000 },
	layers: [],
	_needsProperLoad: false
};

/**
 * Mock layer data for testing
 */
export const mockLayer: Layer = {
	id: 'layer:layer-1' as any,
	name: 'Background',
	order: 0,
	isOptional: false,
	traits: []
};

/**
 * Mock trait data for testing
 */
export const mockTrait: Trait = {
	id: 'trait:trait-1' as any,
	name: 'Red Background',
	imageUrl: 'blob:test',
	imageData: new ArrayBuffer(100),
	width: 1000,
	height: 1000,
	rarityWeight: 3
};

/**
 * Create a complete mock project with layers and traits
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
	const layer1: Layer = {
		...mockLayer,
		id: 'layer:layer-1' as any,
		name: 'Background',
		order: 0,
		traits: [
			{
				...mockTrait,
				id: 'trait:trait-1' as any,
				name: 'Red Background',
				rarityWeight: 3
			},
			{
				...mockTrait,
				id: 'trait:trait-2' as any,
				name: 'Blue Background',
				rarityWeight: 2
			}
		]
	};

	const layer2: Layer = {
		...mockLayer,
		id: 'layer:layer-2' as any,
		name: 'Character',
		order: 1,
		traits: [
			{
				...mockTrait,
				id: 'trait:trait-3' as any,
				name: 'Knight',
				rarityWeight: 5
			}
		]
	};

	return {
		...mockProject,
		id: 'test-project-complete',
		name: 'Complete Test Project',
		layers: [layer1, layer2],
		...overrides
	};
}

/**
 * Create a mock file object
 */
export function createMockFile(
	name: string = 'test.png',
	type: string = 'image/png',
	size: number = 1024
): File {
	const buffer = new ArrayBuffer(size);
	const blob = new Blob([buffer], { type });
	return new File([blob], name, { type });
}

/**
 * Render a component with test utilities
 */
export function renderWithTestUtils(
	component: SvelteComponent,
	props: Record<string, unknown> = {}
): RenderResult {
	return render(component, { props, target: document.body });
}

/**
 * Wait for the next animation frame
 */
export function waitForNextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

/**
 * Create a mock worker message
 */
export function createMockWorkerMessage(type: string, payload: unknown) {
	return { type, payload };
}

/**
 * Mock loading states
 */
export const mockLoadingStates = {
	generation: false,
	import: false,
	export: false
};

/**
 * Mock error handling functions
 */
export const mockErrorHandlers = {
	showError: vi.fn(),
	showSuccess: vi.fn(),
	showWarning: vi.fn(),
	showInfo: vi.fn()
};

/**
 * Mock project store
 */
export function createMockProjectStore(overrides: Partial<Project> = {}) {
	const project = createMockProject(overrides);
	return {
		subscribe: vi.fn(),
		set: vi.fn(),
		update: vi.fn(),
		project
	};
}

/**
 * Helper to test file upload functionality
 */
export function createFileUploadEvent(file: File): Event {
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	const event = new Event('drop', { bubbles: true });
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
	return event;
}

/**
 * Helper to create mock canvas data
 */
export function createMockCanvasData(width: number = 1000, height: number = 1000): ArrayBuffer {
	const size = width * height * 4; // 4 bytes per pixel (RGBA)
	return new ArrayBuffer(size);
}

/**
 * Helper to test progress updates
 */
export function createMockProgressUpdate(
	generated: number,
	total: number,
	statusText: string = 'Processing...'
) {
	return {
		type: 'progress',
		payload: {
			generatedCount: generated,
			totalCount: total,
			statusText,
			memoryUsage: {
				used: 100 * 1024 * 1024, // 100MB
				available: 500 * 1024 * 1024, // 500MB
				units: 'bytes'
			}
		}
	};
}

/**
 * Helper to test error scenarios
 */
export function createMockError(message: string = 'Test error') {
	return {
		type: 'error',
		payload: {
			message,
			code: 'TEST_ERROR'
		}
	};
}

/**
 * Helper to test completion scenarios
 */
export function createMockCompletionMessage(
	images: Array<{ name: string; imageData: ArrayBuffer }> = [],
	metadata: Array<{ name: string; data: Record<string, unknown> }> = []
) {
	return {
		type: 'complete',
		payload: {
			images,
			metadata
		}
	};
}
