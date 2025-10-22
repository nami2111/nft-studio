/**
 * Test suite for GenerationForm component.
 *
 * @module GenerationForm.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import GenerationForm from './GenerationForm.svelte';
import { createMockProject, createMockProgressUpdate, createMockError, createMockCompletionMessage } from './test-utils';
import type { Project } from '$lib/types/project';

// Create mock functions first
const mockStartLoading = vi.fn();
const mockStopLoading = vi.fn();
const mockStartGeneration = vi.fn();
const mockCancelGeneration = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowWarning = vi.fn();
const mockShowInfo = vi.fn();

// Mock dependencies
vi.mock('$lib/stores', () => ({
	project: writable(createMockProject()),
	loadingStates: writable({ generation: false }),
	startLoading: mockStartLoading,
	stopLoading: mockStopLoading
}));

vi.mock('$lib/domain/worker.service', () => ({
	startGeneration: mockStartGeneration,
	cancelGeneration: mockCancelGeneration
}));

vi.mock('$lib/utils/error-handling', () => ({
	showError: mockShowError,
	showSuccess: mockShowSuccess,
	showWarning: mockShowWarning,
	showInfo: mockShowInfo
}));

vi.mock('jszip', () => ({
	default: class MockJSZip {
		folder() {
			return {
				file: vi.fn()
			};
		}
		generateAsync() {
			return Promise.resolve(new Blob(['test content'], { type: 'application/zip' }));
		}
	}
}));

// Mock UI components
vi.mock('$lib/components/LoadingIndicator.svelte', () => ({
	default: {
		render: () => '<div data-testid="loading-indicator">Loading...</div>'
	}
}));

vi.mock('$lib/components/ui/progress', () => ({
	Progress: {
		render: () => '<div data-testid="progress-bar"></div>'
	}
}));

vi.mock('$lib/components/ui/button', () => ({
	Button: {
		render: () => '<button data-testid="button">Button</button>'
	}
}));

describe('GenerationForm', () => {
	let mockProject: Project;
	let mockProjectStore: any;

	beforeEach(() => {
		mockProject = createMockProject();
		mockProjectStore = writable(mockProject);

		// Reset all mocks
		vi.clearAllMocks();

		// Mock document.createElement and click for download
		const mockAnchor = {
			href: '',
			download: '',
			click: vi.fn(),
			style: { display: '' }
		};
		vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
		vi.spyOn(document.body, 'appendChild').mockImplementation();
		vi.spyOn(document.body, 'removeChild').mockImplementation();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State', () => {
		it('renders with default values', () => {
			render(GenerationForm);

			expect(screen.getByLabelText(/collection size/i)).toBeInTheDocument();
			expect(screen.getByDisplayValue('100')).toBeInTheDocument();
			expect(screen.getByText(/ready to generate/i)).toBeInTheDocument();
		});

		it('disables generate button when no collection size', () => {
			render(GenerationForm);

			const sizeInput = screen.getByLabelText(/collection size/i);
			const generateButton = screen.getByText(/generate/i);

			fireEvent.input(sizeInput, { target: { value: '' } });

			expect(generateButton).toBeDisabled();
		});

		it('disables generate button during generation', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');
			(startGeneration as any).mockImplementation(() => {
				// Simulate loading state change
				const { loadingStates } = require('$lib/stores');
				loadingStates.set({ generation: true });
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(generateButton).toBeDisabled();
			});
		});
	});

	describe('Validation', () => {
		it('prevents generation when project has no layers', async () => {
			const { project } = await import('$lib/stores');
			const projectWithNoLayers = createMockProject({ layers: [] });
			project.set(projectWithNoLayers);

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			expect(mockShowWarning).toHaveBeenCalledWith(
				'Project must have at least one layer.',
				expect.objectContaining({ description: 'Validation Error' })
			);
		});

		it('prevents generation when project has invalid output size', async () => {
			const projectWithInvalidSize = createMockProject({
				outputSize: { width: 0, height: 0 }
			});
			const { project } = require('$lib/stores');
			project.set(projectWithInvalidSize);

			const { showWarning } = await import('$lib/utils/error-handling');

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			expect(showWarning).toHaveBeenCalledWith(
				'Project output size not set. Please upload an image to set the project dimensions.',
				expect.objectContaining({ description: 'Validation Error' })
			);
		});

		it('prevents generation when layers have no traits', async () => {
			const projectWithEmptyLayers = createMockProject({
				layers: [
					{
						id: 'layer-1',
						name: 'Empty Layer',
						order: 0,
						isOptional: false,
						traits: []
					}
				]
			});
			const { project } = require('$lib/stores');
			project.set(projectWithEmptyLayers);

			const { showWarning } = await import('$lib/utils/error-handling');

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			expect(showWarning).toHaveBeenCalledWith(
				'The following layers have no traits: Empty Layer',
				expect.objectContaining({ description: 'Validation Error' })
			);
		});

		it('prevents generation when traits have no image data', async () => {
			const projectWithMissingImages = createMockProject({
				layers: [
					{
						id: 'layer-1',
						name: 'Layer with Missing Images',
						order: 0,
						isOptional: false,
						traits: [
							{
								id: 'trait-1',
								name: 'Trait No Image',
								imageUrl: 'blob:test',
								imageData: new ArrayBuffer(0), // Empty image data
								width: 1000,
								height: 1000,
								rarityWeight: 3
							}
						]
					}
				]
			});
			const { project } = require('$lib/stores');
			project.set(projectWithMissingImages);

			const { showWarning } = await import('$lib/utils/error-handling');

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			expect(showWarning).toHaveBeenCalledWith(
				'Missing image data for 1 traits. Please upload images for all traits before generating.',
				expect.objectContaining({ description: 'Validation Error' })
			);
		});
	});

	describe('Progress Updates', () => {
		it('updates progress bar during generation', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate progress update
				const progressUpdate = createMockProgressUpdate(50, 100, 'Generating images...');
				await messageHandler(progressUpdate);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(screen.getByText(/generating images/i)).toBeInTheDocument();
			});
		});

		it('calculates progress percentage correctly', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate 50% progress
				const progressUpdate = createMockProgressUpdate(50, 100, 'Halfway done...');
				await messageHandler(progressUpdate);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(screen.getByText(/halfway done/i)).toBeInTheDocument();
			});
		});

		it('displays memory usage when provided', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate progress with memory usage
				const progressUpdate = {
					type: 'progress',
					payload: {
						generatedCount: 25,
						totalCount: 100,
						statusText: 'Using memory...',
						memoryUsage: {
							used: 200 * 1024 * 1024, // 200MB
							available: 500 * 1024 * 1024, // 500MB
							units: 'bytes'
						}
					}
				};
				await messageHandler(progressUpdate);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(screen.getByText(/memory:.*200mb.*\/.*500mb/i)).toBeInTheDocument();
			});
		});
	});

	describe('Generation Completion', () => {
		it('packages and downloads generated images', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');
			const { showSuccess } = await import('$lib/utils/error-handling');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate completion with images
				const completionMessage = createMockCompletionMessage(
					[
						{
							name: '1.png',
							imageData: new ArrayBuffer(1000)
						},
						{
							name: '2.png',
							imageData: new ArrayBuffer(1000)
						}
					],
					[
						{
							name: '1.json',
							data: { name: 'NFT #1', attributes: [] }
						}
					]
				);
				await messageHandler(completionMessage);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(showSuccess).toHaveBeenCalledWith(
					'Generation complete',
					expect.objectContaining({ description: 'Your download has started.' })
				);
			});

			// Verify download was triggered
			expect(document.createElement).toHaveBeenCalledWith('a');
		});

		it('handles chunked image data correctly', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Send first chunk
				const chunk1 = createMockCompletionMessage(
					[{ name: '1.png', imageData: new ArrayBuffer(1000) }],
					[{ name: '1.json', data: { name: 'NFT #1' } }]
				);
				await messageHandler(chunk1);

				// Send final chunk (empty images to signal completion)
				const chunk2 = createMockCompletionMessage([], []);
				await messageHandler(chunk2);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(screen.getByText(/download started/i)).toBeInTheDocument();
			});
		});
	});

	describe('Error Handling', () => {
		it('displays error message when generation fails', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');
			const { showError } = await import('$lib/utils/error-handling');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate error
				const errorMessage = createMockError('Canvas rendering failed');
				await messageHandler(errorMessage);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(showError).toHaveBeenCalledWith(
					expect.any(Error),
					expect.objectContaining({
						title: 'Generation Error',
						description: 'An error occurred during generation. Please try again.'
					})
				);
			});
		});

		it('resets state after error', async () => {
			const { startGeneration, cancelGeneration } = await import('$lib/domain/worker.service');
			const { stopLoading } = await import('$lib/stores');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate error
				const errorMessage = createMockError('Test error');
				await messageHandler(errorMessage);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(stopLoading).toHaveBeenCalledWith('generation');
			});

			// Form should be ready for new generation
			expect(screen.getByDisplayValue('100')).toBeInTheDocument();
			expect(screen.getByText(/ready to generate/i)).toBeInTheDocument();
		});
	});

	describe('Cancellation', () => {
		it('cancels generation when cancel button is clicked', async () => {
			const { startGeneration, cancelGeneration } = await import('$lib/domain/worker.service');
			const { showInfo } = await import('$lib/utils/error-handling');

			// Start generation but don't complete it
			(startGeneration as any).mockImplementation(async () => {
				// Keep running until cancelled
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			// Wait for generation to start
			await waitFor(() => {
				expect(screen.getByText(/canceling/i)).toBeInTheDocument();
			});

			// Click cancel button
			const cancelButton = screen.getByText(/cancel/i);
			await fireEvent.click(cancelButton);

			expect(cancelGeneration).toHaveBeenCalled();
			expect(showInfo).toHaveBeenCalledWith('Generation has been cancelled.');
		});

		it('handles cancellation message from worker', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');
			const { showInfo } = await import('$lib/utils/error-handling');

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate cancellation from worker
				const cancelMessage = {
					type: 'cancelled',
					payload: {
						generatedCount: 25,
						totalCount: 100
					}
				};
				await messageHandler(cancelMessage);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				expect(showInfo).toHaveBeenCalledWith('Generation has been cancelled.');
			});

			expect(screen.getByText(/generation cancelled by user/i)).toBeInTheDocument();
		});
	});

	describe('Form Input', () => {
		it('updates collection size when input changes', () => {
			render(GenerationForm);

			const sizeInput = screen.getByLabelText(/collection size/i);
			fireEvent.input(sizeInput, { target: { value: '500' } });

			expect(sizeInput).toHaveValue(500);
		});

		it('validates collection size bounds', async () => {
			render(GenerationForm);

			const sizeInput = screen.getByLabelText(/collection size/i);
			const generateButton = screen.getByText(/generate/i);

			// Test minimum bound
			fireEvent.input(sizeInput, { target: { value: '0' } });
			expect(generateButton).toBeDisabled();

			// Test maximum bound
			fireEvent.input(sizeInput, { target: { value: '10001' } });
			expect(generateButton).toBeDisabled();

			// Test valid range
			fireEvent.input(sizeInput, { target: { value: '5000' } });
			expect(generateButton).not.toBeDisabled();
		});

		it('disables inputs during generation', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');

			// Simulate generation that doesn't complete immediately
			(startGeneration as any).mockImplementation(async () => {
				// Keep running
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			// Wait for generation to start
			await waitFor(() => {
				const sizeInput = screen.getByLabelText(/collection size/i);
				expect(sizeInput).toBeDisabled();
			});
		});
	});

	describe('Memory Management', () => {
		it('cleans up preview URLs after completion', async () => {
			const { startGeneration } = await import('$lib/domain/worker.service');
			const mockRevokeObjectURL = vi.fn();

			global.URL.revokeObjectURL = mockRevokeObjectURL;

			let messageHandler: any;
			(startGeneration as any).mockImplementation(async (
				layers: any[],
				count: number,
				size: any,
				name: string,
				description: string,
				handler: any
			) => {
				messageHandler = handler;

				// Simulate preview generation
				const previewMessage = {
					type: 'preview',
					payload: {
						indexes: [0, 1],
						previewData: [new ArrayBuffer(1000), new ArrayBuffer(1000)]
					}
				};
				await messageHandler(previewMessage);

				// Complete generation
				const completionMessage = createMockCompletionMessage();
				await messageHandler(completionMessage);
			});

			render(GenerationForm);

			const generateButton = screen.getByText(/generate/i);
			await fireEvent.click(generateButton);

			await waitFor(() => {
				// URLs should be revoked after completion
				expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2); // 2 preview URLs
			});
		});
	});
});