import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import GenerationForm from './GenerationForm.svelte';
import { createMockProject } from '../test-utils';
import type { Project } from '$lib/types/project';

// Test-specific store state
let mockProjectState: Project;
let generationStateMock: any;

// Mock dependencies
vi.mock('$lib/stores', async () => {
	const { writable } = await import('svelte/store');

	// Create a proxy that reads from the module-level mockProjectState
	const projectProxy = {
		get id() {
			return mockProjectState?.id;
		},
		get name() {
			return mockProjectState?.name;
		},
		get layers() {
			return mockProjectState?.layers;
		},
		get outputSize() {
			return mockProjectState?.outputSize;
		},
		get strictPairConfig() {
			return mockProjectState?.strictPairConfig;
		},
		get metadataStandard() {
			return mockProjectState?.metadataStandard;
		},
		// Setter to allow tests to update the state via the store import if needed
		set: (newState: any) => {
			mockProjectState = newState;
		}
	};

	return {
		project: projectProxy,
		loadingStates: writable({ generation: false }),
		startLoading: vi.fn(),
		stopLoading: vi.fn()
	};
});

vi.mock('$lib/domain/worker.service', () => ({
	startGeneration: vi.fn(),
	cancelGeneration: vi.fn()
}));

vi.mock('$lib/utils/error-handling', () => ({
	showError: vi.fn(),
	showSuccess: vi.fn(),
	showWarning: vi.fn(),
	showInfo: vi.fn()
}));

// Mock generation store
vi.mock('$lib/stores/generation-progress.svelte', () => ({
	get generationState() {
		return generationStateMock;
	},
	resetState: vi.fn(),
	startGeneration: vi.fn(),
	pauseGeneration: vi.fn(),
	completeGeneration: vi.fn(),
	cancelGeneration: vi.fn(),
	updateProgress: vi.fn(),
	addImages: vi.fn(),
	addMetadata: vi.fn(),
	addPreviews: vi.fn(),
	handleError: vi.fn()
}));

// Real child components are used (unmocked) to avoid Svelte 5 render issues.
// Real UI components (Button, Progress) are used.

describe('GenerationForm', () => {
	beforeEach(() => {
		// Reset state before each test
		mockProjectState = createMockProject();
		generationStateMock = {
			isGenerating: false,
			isBackground: false,
			isPaused: false,
			previews: [],
			progress: 0,
			statusText: '',
			memoryUsage: null,
			sessionId: null,
			startTime: null,
			completionTime: null,
			error: null,
			allImages: [],
			allMetadata: [],
			warnings: [],
			lastWarningTimes: new Map()
		};
		vi.clearAllMocks();
	});

	describe('Initial State', () => {
		it('renders with default values', () => {
			render(GenerationForm);
			expect(screen.getByLabelText(/collection size/i)).toBeInTheDocument();
			// Default collection size is 100
			expect(screen.getByLabelText(/collection size/i)).toHaveValue(100);
			expect(screen.getByText(/generate/i)).toBeInTheDocument();
		});

		it('disables generate button when collection size is invalid', async () => {
			render(GenerationForm);
			const input = screen.getByLabelText(/collection size/i);
			const button = screen.getByRole('button', { name: /generate/i });

			await fireEvent.input(input, { target: { value: '0' } });
			expect(button).toBeDisabled();

			await fireEvent.input(input, { target: { value: '-5' } });
			expect(button).toBeDisabled();
		});
	});

	describe('Validation', () => {
		it('prevents generation when project has no layers', async () => {
			// Setup project with no layers
			mockProjectState = { ...createMockProject(), layers: [] };
			const { showWarning } = await import('$lib/utils/error-handling');

			render(GenerationForm);
			const button = screen.getByRole('button', { name: /generate/i });

			await fireEvent.click(button);

			expect(showWarning).toHaveBeenCalledWith(
				expect.stringMatching(/must have at least one layer/i),
				expect.any(Object)
			);
		});

		it('prevents generation when project has invalid output size', async () => {
			mockProjectState = { ...createMockProject(), outputSize: { width: 0, height: 0 } };
			const { showWarning } = await import('$lib/utils/error-handling');

			render(GenerationForm);
			const button = screen.getByRole('button', { name: /generate/i });

			await fireEvent.click(button);

			expect(showWarning).toHaveBeenCalledWith(
				expect.stringMatching(/output size not set/i),
				expect.any(Object)
			);
		});
	});

	describe('Generation Flow', () => {
		it('starts generation when inputs are valid', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			render(GenerationForm);
			const button = screen.getByRole('button', { name: /generate/i });

			await fireEvent.click(button);

			expect(startGeneration).toHaveBeenCalled();
		});

		it('disables inputs during generation', () => {
			generationStateMock.isGenerating = true;

			render(GenerationForm);

			const input = screen.getByLabelText(/collection size/i);
			const generateButton = screen.getByRole('button', { name: /generating/i });

			expect(input).toBeDisabled();
			expect(generateButton).toBeDisabled();
		});

		it('shows completion message when generation is finished', async () => {
			generationStateMock.isGenerating = false;
			generationStateMock.completionTime = Date.now();
			generationStateMock.progress = 100;
			generationStateMock.totalItems = 10;

			render(GenerationForm);

			expect(screen.getByText(/generation complete/i)).toBeInTheDocument();
			expect(screen.getByText(/10 nfts ready/i)).toBeInTheDocument();
		});
	});
});
