/**
 * Test suite for ProjectManagement component.
 *
 * @module ProjectManagement.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import ProjectManagement from './ProjectManagement.svelte';
import { createMockProject, createMockFile } from './test-utils';
import type { Project } from '$lib/types';

// Mock dependencies
vi.mock('$lib/stores', () => ({
	project: writable(createMockProject()),
	loadProjectFromZip: vi.fn(),
	saveProjectToZip: vi.fn(),
	projectNeedsZipLoad: vi.fn(() => false),
	markProjectAsLoaded: vi.fn(),
	getLoadingState: vi.fn(() => false),
	getDetailedLoadingState: vi.fn(() => null),
	startDetailedLoading: vi.fn(),
	stopDetailedLoading: vi.fn(),
	startLoading: vi.fn(),
	stopLoading: vi.fn()
}));

vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

// Mock child components
vi.mock('$lib/components/LoadingIndicator.svelte', () => ({
	default: {
		render: (props: any) => `
			<div data-testid="loading-indicator">
				${props.operation}: ${props.message}
			</div>
		`
	}
}));

vi.mock('$lib/components/ui/modal', () => ({
	Modal: {
		render: (props: any) => `
			<div data-testid="modal" data-open="${props.open}">
				<h2 data-testid="modal-title">${props.title}</h2>
				<button data-testid="modal-close" onclick="${props.onClose}">Close</button>
				${$$slots.default()}
			</div>
		`
	}
}));

// Mock UI components
vi.mock('$lib/components/ui/button', () => ({
	Button: {
		render: (props: any) => `
			<button
				data-testid="button"
				data-variant="${props.variant || 'default'}"
				disabled="${props.disabled || false}"
				onclick="${props.onclick}"
			>
				${$$slots.default ? $$slots.default() : 'Button'}
			</button>
		`
	}
}));

vi.mock('$lib/components/ui/card', () => ({
	Card: {
		render: (props: any) => `<div data-testid="card">${$$slots.default()}</div>`
	},
	CardContent: {
		render: (props: any) => `<div data-testid="card-content">${$$slots.default()}</div>`
	}
}));

// Mock lucide icons
vi.mock('lucide-svelte', () => ({
	FolderOpen: { render: () => '<span data-testid="folder-icon">Folder</span>' },
	Save: { render: () => '<span data-testid="save-icon">Save</span>' },
	AlertTriangle: { render: () => '<span data-testid="alert-icon">Alert</span>' },
	Upload: { render: () => '<span data-testid="upload-icon">Upload</span>' },
	Download: { render: () => '<span data-testid="download-icon">Download</span>' }
}));

describe('ProjectManagement', () => {
	let mockProject: Project;

	beforeEach(() => {
		mockProject = createMockProject();

		// Reset all mocks
		vi.clearAllMocks();

		// Mock URL.createObjectURL and revokeObjectURL
		global.URL.createObjectURL = vi.fn(() => 'mocked-blob-url');
		global.URL.revokeObjectURL = vi.fn();

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

		// Mock confirm dialog
		global.confirm = vi.fn(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State', () => {
		it('renders load and save buttons', () => {
			render(ProjectManagement);

			expect(screen.getByText(/load project/i)).toBeInTheDocument();
			expect(screen.getByText(/save project/i)).toBeInTheDocument();
			expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
			expect(screen.getByTestId('download-icon')).toBeInTheDocument();
		});

		it('shows save reminder when project needs zip load', () => {
			const { projectNeedsZipLoad } = require('$lib/stores');
			projectNeedsZipLoad.mockReturnValue(true);

			render(ProjectManagement);

			expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
			expect(screen.getByText(/don't forget to save your project/i)).toBeInTheDocument();
		});

		it('hides save reminder when project does not need zip load', () => {
			const { projectNeedsZipLoad } = require('$lib/stores');
			projectNeedsZipLoad.mockReturnValue(false);

			render(ProjectManagement);

			expect(screen.queryByTestId('alert-icon')).not.toBeInTheDocument();
		});

		it('shows responsive text labels', () => {
			render(ProjectManagement);

			// Should show both full and short text versions
			expect(screen.getByText(/load project/i)).toBeInTheDocument();
			expect(screen.getByText(/load/i)).toBeInTheDocument();
			expect(screen.getByText(/save project/i)).toBeInTheDocument();
			expect(screen.getByText(/save/i)).toBeInTheDocument();
		});
	});

	describe('Load Project Modal', () => {
		it('opens load modal when load button is clicked', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			expect(screen.getByTestId('modal')).toBeInTheDocument();
			expect(screen.getByTestId('modal-title')).toHaveTextContent('Load Project');
			expect(screen.getByText(/upload a previously saved project/i)).toBeInTheDocument();
		});

		it('closes modal when close button is clicked', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const closeButton = screen.getByTestId('modal-close');
			await fireEvent.click(closeButton);

			// Modal should be closed (open=false)
			const modal = screen.getByTestId('modal');
			expect(modal).toHaveAttribute('data-open', 'false');
		});

		it('shows loading state during project loading', async () => {
			const { getLoadingState } = require('$lib/stores');
			getLoadingState.mockReturnValue(true);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
			expect(screen.getByTestId('loading-indicator')).toHaveTextContent('project-load: Loading project...');
		});

		it('shows progress bar when loading progress is available', async () => {
			const { getDetailedLoadingState } = require('$lib/stores');
			getDetailedLoadingState.mockReturnValue({
				progress: 50,
				message: 'Processing images...'
			});

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const progressBar = document.querySelector('[style*="width: 50%"]');
			expect(progressBar).toBeInTheDocument();
			expect(screen.getByText(/processing images/i)).toBeInTheDocument();
		});

		it('handles file input change', async () => {
			const { loadProjectFromZip, toast } = require('$lib/stores');
			loadProjectFromZip.mockResolvedValue(undefined);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox'); // Hidden file input
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(loadProjectFromZip).toHaveBeenCalledWith(mockFile);
			expect(toast.success).toHaveBeenCalledWith('Project loaded successfully!');
		});

		it('handles drag and drop file upload', async () => {
			const { loadProjectFromZip, toast } = require('$lib/stores');
			loadProjectFromZip.mockResolvedValue(undefined);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const dropZone = screen.getByText(/drop a .zip project file/i).closest('div');
			const mockFile = createMockFile('project.zip', 'application/zip');

			// Create mock drop event
			const mockEvent = {
				preventDefault: vi.fn(),
				dataTransfer: {
					files: [mockFile]
				}
			} as any;

			await fireEvent.drop(dropZone!, mockEvent);

			expect(loadProjectFromZip).toHaveBeenCalledWith(mockFile);
			expect(toast.success).toHaveBeenCalledWith('Project loaded successfully!');
		});

		it('validates file type before loading', async () => {
			const { toast } = require('$lib/stores');

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const invalidFile = createMockFile('project.txt', 'text/plain');

			await fireEvent.change(fileInput, { target: { files: [invalidFile] } });

			expect(toast.error).toHaveBeenCalledWith('Please select a valid .zip project file');
		});

		it('shows confirmation when there are unsaved changes', async () => {
			// Mock project with unsaved changes
			const { project } = require('$lib/stores');
			project.set({
				...mockProject,
				name: 'Modified Project',
				layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, traits: [] }]
			});

			global.confirm = vi.fn(() => false);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(global.confirm).toHaveBeenCalledWith(
				'Loading a new project will discard current unsaved changes. Proceed?'
			);
		});

		it('handles load errors gracefully', async () => {
			const { loadProjectFromZip, toast } = require('$lib/stores');
			const testError = new Error('Failed to load project');
			loadProjectFromZip.mockRejectedValue(testError);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(toast.error).toHaveBeenCalledWith('Failed to load project');
		});
	});

	describe('Save Project Modal', () => {
		it('opens save modal when save button is clicked', async () => {
			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			expect(screen.getByTestId('modal')).toBeInTheDocument();
			expect(screen.getByTestId('modal-title')).toHaveTextContent('Save Project');
			expect(screen.getByText(/download your project configuration/i)).toBeInTheDocument();
		});

		it('closes modal when close button is clicked', async () => {
			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const closeButton = screen.getByTestId('modal-close');
			await fireEvent.click(closeButton);

			const modal = screen.getByTestId('modal');
			expect(modal).toHaveAttribute('data-open', 'false');
		});

		it('saves project and triggers download', async () => {
			const { saveProjectToZip, toast } = require('$lib/stores');
			saveProjectToZip.mockResolvedValue(new ArrayBuffer(1000));

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const saveProjectButton = screen.getByText(/save project$/); // The button inside modal
			await fireEvent.click(saveProjectButton);

			expect(saveProjectToZip).toHaveBeenCalled();
			expect(document.createElement).toHaveBeenCalledWith('a');
			expect(toast.success).toHaveBeenCalledWith('Project saved successfully!');
		});

		it('shows loading state during project saving', async () => {
			const { getLoadingState } = require('$lib/stores');
			getLoadingState.mockReturnValue(true);

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
			expect(screen.getByTestId('loading-indicator')).toHaveTextContent('project-save: Saving project...');
		});

		it('shows progress bar when saving progress is available', async () => {
			const { getDetailedLoadingState } = require('$lib/stores');
			getDetailedLoadingState.mockReturnValue({
				progress: 75,
				message: 'Compressing files...'
			});

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const progressBar = document.querySelector('[style*="width: 75%"]');
			expect(progressBar).toBeInTheDocument();
			expect(screen.getByText(/compressing files/i)).toBeInTheDocument();
		});

		it('handles save errors gracefully', async () => {
			const { saveProjectToZip, toast } = require('$lib/stores');
			const testError = new Error('Failed to save project');
			saveProjectToZip.mockRejectedValue(testError);

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const saveProjectButton = screen.getByText(/save project$/);
			await fireEvent.click(saveProjectButton);

			expect(toast.error).toHaveBeenCalledWith('Failed to save project');
		});

		it('uses project name for download filename', async () => {
			const { project, saveProjectToZip } = require('$lib/stores');
			project.set({ ...mockProject, name: 'My Awesome Collection' });
			saveProjectToZip.mockResolvedValue(new ArrayBuffer(1000));

			const mockAnchor = {
				href: '',
				download: '',
				click: vi.fn(),
				style: { display: '' }
			};
			document.createElement = vi.fn().mockReturnValue(mockAnchor);

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const saveProjectButton = screen.getByText(/save project$/);
			await fireEvent.click(saveProjectButton);

			expect(mockAnchor.download).toBe('My Awesome Collection.zip');
		});

		it('uses default filename when project has no name', async () => {
			const { project, saveProjectToZip } = require('$lib/stores');
			project.set({ ...mockProject, name: '' });
			saveProjectToZip.mockResolvedValue(new ArrayBuffer(1000));

			const mockAnchor = {
				href: '',
				download: '',
				click: vi.fn(),
				style: { display: '' }
			};
			document.createElement = vi.fn().mockReturnValue(mockAnchor);

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const saveProjectButton = screen.getByText(/save project$/);
			await fireEvent.click(saveProjectButton);

			expect(mockAnchor.download).toBe('nft-project.zip');
		});
	});

	describe('Drag and Drop Functionality', () => {
		it('handles drag over events', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const dropZone = screen.getByText(/drop a .zip project file/i).closest('div');
			const mockEvent = {
				preventDefault: vi.fn(),
				dataTransfer: {
					dropEffect: 'copy'
				}
			} as any;

			await fireEvent.dragOver(dropZone!, mockEvent);

			expect(mockEvent.preventDefault).toHaveBeenCalled();
			expect(mockEvent.dataTransfer.dropEffect).toBe('copy');
		});

		it('handles drag enter and leave events', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const dropZone = screen.getByText(/drop a .zip project file/i).closest('div');

			await fireEvent.dragEnter(dropZone!);
			await fireEvent.dragLeave(dropZone!);

			// Should prevent default behavior
			expect(dropZone).toBeInTheDocument();
		});
	});

	describe('Unsaved Changes Detection', () => {
		it('detects unsaved changes when project has layers', async () => {
			const { project } = require('$lib/stores');
			project.set({
				...mockProject,
				layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, traits: [] }]
			});

			render(ProjectManagement);

			// Component should detect unsaved changes and show confirmation dialog
			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(global.confirm).toHaveBeenCalled();
		});

		it('detects unsaved changes when project has name', async () => {
			const { project } = require('$lib/stores');
			project.set({ ...mockProject, name: 'My Project' });

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(global.confirm).toHaveBeenCalled();
		});

		it('detects unsaved changes when project has description', async () => {
			const { project } = require('$lib/stores');
			project.set({ ...mockProject, description: 'My description' });

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(global.confirm).toHaveBeenCalled();
		});

		it('does not show confirmation for empty project', async () => {
			const { project } = require('$lib/stores');
			project.set({ ...mockProject, name: '', description: '', layers: [] });

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			expect(global.confirm).not.toHaveBeenCalled();
		});
	});

	describe('Accessibility', () => {
		it('provides proper button roles and labels', () => {
			render(ProjectManagement);

			const buttons = screen.getAllByRole('button');
			expect(buttons.length).toBeGreaterThan(0);

			// Check that buttons have appropriate content
			expect(screen.getByText(/load project/i)).toBeInTheDocument();
			expect(screen.getByText(/save project/i)).toBeInTheDocument();
		});

		it('provides proper file input accessibility', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByDisplayValue(''); // Hidden file input
			expect(fileInput).toHaveAttribute('type', 'file');
			expect(fileInput).toHaveAttribute('accept', '.zip');
		});

		it('provides proper drop zone accessibility', async () => {
			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const dropZone = screen.getByText(/drop a .zip project file/i).closest('div');
			expect(dropZone).toHaveAttribute('role', 'button');
			expect(dropZone).toHaveAttribute('tabindex', '0');
		});
	});

	describe('Memory Management', () => {
		it('cleans up file input values after operations', async () => {
			const { loadProjectFromZip } = require('$lib/stores');
			loadProjectFromZip.mockResolvedValue(undefined);

			render(ProjectManagement);

			const loadButton = screen.getByText(/load project/i);
			await fireEvent.click(loadButton);

			const fileInput = screen.getByRole('textbox');
			const mockFile = createMockFile('project.zip', 'application/zip');

			// Mock the file input element to track value changes
			Object.defineProperty(fileInput, 'value', {
				get: () => fileInput._value || '',
				set: (value) => { fileInput._value = value; }
			});

			await fireEvent.change(fileInput, { target: { files: [mockFile] } });

			// Value should be reset after operation
			await waitFor(() => {
				expect(fileInput.value).toBe('');
			});
		});

		it('revokes object URLs after download', async () => {
			const { saveProjectToZip } = require('$lib/stores');
			saveProjectToZip.mockResolvedValue(new ArrayBuffer(1000));

			render(ProjectManagement);

			const saveButton = screen.getByText(/save project/i);
			await fireEvent.click(saveButton);

			const saveProjectButton = screen.getByText(/save project$/);
			await fireEvent.click(saveProjectButton);

			await waitFor(() => {
				expect(global.URL.revokeObjectURL).toHaveBeenCalled();
			});
		});
	});
});