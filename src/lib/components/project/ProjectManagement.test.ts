import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ProjectManagement from './ProjectManagement.svelte';
import { createMockProject } from '../test-utils';
import type { Project } from '$lib/types/project';

// Basic mock for project state
let mockProjectState: Project;

// Helper to update mock state
const setMockProject = (newState: any) => {
	mockProjectState = newState;
};

// Mock dependencies
vi.mock('$lib/stores', async () => {
	const projectProxy = {
		get id() {
			return mockProjectState?.id;
		},
		get name() {
			return mockProjectState?.name;
		},
		get layers() {
			return mockProjectState?.layers || [];
		},
		get outputSize() {
			return mockProjectState?.outputSize;
		},
		get description() {
			return mockProjectState?.description;
		},
		get _needsProperLoad() {
			return mockProjectState?._needsProperLoad;
		},
		set: (newState: any) => {
			mockProjectState = newState;
		}
	};

	return {
		project: projectProxy,
		projectNeedsZipLoad: vi.fn(() => mockProjectState?._needsProperLoad || false),
		markProjectAsLoaded: vi.fn(),
		getLoadingState: vi.fn(() => false),
		getDetailedLoadingState: vi.fn(() => ({ progress: 0, message: '' })),
		startDetailedLoading: vi.fn(),
		updateDetailedLoading: vi.fn(),
		stopDetailedLoading: vi.fn(),
		startLoading: vi.fn(),
		stopLoading: vi.fn(),
		loadProjectFromZip: vi.fn().mockResolvedValue({}),
		saveProjectToZip: vi.fn().mockResolvedValue(new ArrayBuffer(10)), // Return dummy buffer
		loadingStates: {}
	};
});

vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

// Mock JSZip
vi.mock('jszip', () => {
	return {
		default: class JSZipMock {
			static loadAsync = vi.fn().mockResolvedValue({
				file: vi.fn(),
				files: {}
			});
			file = vi.fn();
		}
	};
});

// Mock resource manager
vi.mock('$lib/stores/resource-manager', () => ({
	globalResourceManager: {
		addObjectUrl: vi.fn(),
		removeObjectUrl: vi.fn(),
		cleanup: vi.fn()
	}
}));

describe('ProjectManagement', () => {
	beforeEach(() => {
		// Reset state
		mockProjectState = {
			...createMockProject(),
			_needsProperLoad: false,
			description: ''
		};
		vi.clearAllMocks();

		// Mocks for window/document interaction
		URL.createObjectURL = vi.fn(() => 'blob:url');
		URL.revokeObjectURL = vi.fn();
	});

	describe('Rendering and Interactions', () => {
		it('renders load and save buttons', () => {
			render(ProjectManagement);
			const loadButtons = screen.getAllByText(/Load/i);
			const saveButtons = screen.getAllByText(/Save/i);
			expect(loadButtons.length).toBeGreaterThan(0);
			expect(saveButtons.length).toBeGreaterThan(0);
		});

		it('shows needs-save warning if project needs proper load', async () => {
			// Re-import to affect the mock behavior (imports are live) or just rely on the proxy reading the state
			setMockProject({ ...mockProjectState, _needsProperLoad: true });

			// Clean render to pick up new state
			render(ProjectManagement);

			expect(screen.getByText(/don't forget to save/i)).toBeInTheDocument();
		});

		it('opens save modal when save button is clicked', async () => {
			render(ProjectManagement);
			// Click the main Save button (likely the one visible or first one)
			const saveBtns = screen.getAllByText(/Save/i);
			// Determine which one is the button trigger. Often the last one in layout or look for specific hierarchy
			// Given the markup: "Save Project" (hidden), "Save" (visible xs).
			// We just click one of them.
			await fireEvent.click(saveBtns[0]);

			// Check for modal content
			expect(screen.getByRole('dialog')).toBeInTheDocument();
			expect(screen.getByRole('dialog')).toHaveTextContent(/Save Project/i);
		});

		it('opens load modal when load button is clicked', async () => {
			render(ProjectManagement);
			const loadBtns = screen.getAllByText(/Load/i);
			await fireEvent.click(loadBtns[0]);

			expect(screen.getByRole('dialog')).toBeInTheDocument();
			expect(screen.getByRole('dialog')).toHaveTextContent(/Load Project/i);
		});

		it('calls saveProjectToZip when confirming save', async () => {
			const { saveProjectToZip } = await import('$lib/stores');

			render(ProjectManagement);
			const saveBtns = screen.getAllByText(/Save/i); // Main button
			await fireEvent.click(saveBtns[0]);

			// In the modal, there is another "Save Project" button
			// We wait for modal
			const modal = await screen.findByRole('dialog');

			// Find button inside modal.
			// The modal button has text "Save Project".
			// Use within() to scope search
			const { getAllByText } = await import('@testing-library/svelte');
			// Actually 'within' is exported from @testing-library/dom usually, or screen.
			// Let's just find all 'Save Project' and click the last one, or use specific attributes.
			// The component uses <Button ...><Save .../> Save Project</Button> inside modal.

			const allSaveTxt = screen.getAllByText(/Save Project/i);
			const confirmSaveBtn = allSaveTxt[allSaveTxt.length - 1]; // Likely the last one rendered (in modal)

			await fireEvent.click(confirmSaveBtn);

			expect(saveProjectToZip).toHaveBeenCalled();
		});
	});
});
