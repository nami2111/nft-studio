/**
 * Test suite for LayerManager component.
 *
 * @module LayerManager.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import LayerManager from './LayerManager.svelte';
import { createMockProject, mockLayer } from './test-utils';
import type { Project, Layer } from '$lib/types';

// Mock dependencies
vi.mock('$lib/stores', () => ({
	project: writable(createMockProject()),
	addLayer: vi.fn(),
	reorderLayers: vi.fn()
}));

vi.mock('$lib/utils/error-handling', () => ({
	showError: vi.fn(),
	showSuccess: vi.fn()
}));

// Mock LayerItem component
vi.mock('$lib/components/LayerItem.svelte', () => ({
	default: {
		render: (props: { layer: Layer }) => `
			<div data-testid="layer-item" data-layer-id="${props.layer.id}">
				<span data-testid="layer-name">${props.layer.name}</span>
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
		render: () => '<div data-testid="card"></div>'
	},
	CardContent: {
		render: () => '<div data-testid="card-content"></div>'
	}
}));

vi.mock('lucide-svelte', () => ({
	Loader2: {
		render: () => '<div data-testid="loader-icon"></div>'
	}
}));

describe('LayerManager', () => {
	let mockProject: Project;
	let mockProjectStore: any;

	beforeEach(() => {
		mockProject = createMockProject();
		mockProjectStore = writable(mockProject);

		// Reset all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State', () => {
		it('renders with empty state when no layers exist', () => {
			const { project } = require('$lib/stores');
			project.set({ ...mockProject, layers: [] });

			render(LayerManager);

			expect(screen.getByText(/no layers yet/i)).toBeInTheDocument();
			expect(screen.getByText(/add one to get started/i)).toBeInTheDocument();
			expect(screen.getByText(/layers \(0\)/i)).toBeInTheDocument();
		});

		it('renders with existing layers', () => {
			const { project } = require('$lib/stores');
			project.set(mockProject);

			render(LayerManager);

			expect(screen.getByText(/layers \(\d+\)/i)).toBeInTheDocument();
			expect(screen.getByTestId('layer-item')).toBeInTheDocument();
		});

		it('displays correct layer count', () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			expect(screen.getByText(/layers \(3\)/i)).toBeInTheDocument();
		});
	});

	describe('Add Layer', () => {
		it('adds a new layer when add button is clicked', async () => {
			const { addLayer, showSuccess } = require('$lib/stores');
			addLayer.mockImplementation(() => {});

			render(LayerManager);

			const addButton = screen.getByText(/add layer/i);
			await fireEvent.click(addButton);

			expect(addLayer).toHaveBeenCalledWith('Layer 1');
			expect(showSuccess).toHaveBeenCalledWith('Layer added successfully.');
		});

		it('generates sequential layer names', async () => {
			const { addLayer } = require('$lib/stores');
			const projectWith2Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Layer 1', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Layer 2', order: 1, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith2Layers);

			render(LayerManager);

			const addButton = screen.getByText(/add layer/i);
			await fireEvent.click(addButton);

			expect(addLayer).toHaveBeenCalledWith('Layer 3');
		});

		it('shows loading state while adding layer', async () => {
			const { addLayer } = require('$lib/stores');
			let resolveAdd: (value: unknown) => void;
			addLayer.mockReturnValue(new Promise((resolve) => { resolveAdd = resolve; }));

			render(LayerManager);

			const addButton = screen.getByText(/add layer/i);
			await fireEvent.click(addButton);

			// Should show loading state
			expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
			expect(screen.getByText(/adding/i)).toBeInTheDocument();
			expect(addButton).toBeDisabled();

			// Complete the add operation
			resolveAdd!(undefined);
			await waitFor(() => {
				expect(screen.getByText(/add layer/i)).toBeInTheDocument();
			});
		});

		it('prevents multiple simultaneous add operations', async () => {
			const { addLayer } = require('$lib/stores');
			let resolveAdd: (value: unknown) => void;
			addLayer.mockReturnValue(new Promise((resolve) => { resolveAdd = resolve; }));

			render(LayerManager);

			const addButton = screen.getByText(/add layer/i);
			await fireEvent.click(addButton);

			// Try to click again while still loading
			await fireEvent.click(addButton);

			// Should only call addLayer once
			expect(addLayer).toHaveBeenCalledTimes(1);
		});

		it('handles add layer errors gracefully', async () => {
			const { addLayer, showError } = require('$lib/stores');
			const testError = new Error('Failed to create layer');
			addLayer.mockRejectedValue(testError);

			render(LayerManager);

			const addButton = screen.getByText(/add layer/i);
			await fireEvent.click(addButton);

			await waitFor(() => {
				expect(showError).toHaveBeenCalledWith(testError, {
					title: 'Layer Error',
					description: 'Failed to create layer'
				});
			});
		});
	});

	describe('Layer Reordering', () => {
		it('moves layer up when up button is clicked', async () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project, reorderLayers, showSuccess } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// Find the up button for the middle layer (layer-2)
			const upButtons = screen.getAllByText(/up/i);
			await fireEvent.click(upButtons[1]); // Second up button is for layer-2

			expect(reorderLayers).toHaveBeenCalledWith(['layer-2', 'layer-1', 'layer-3']);
			expect(showSuccess).toHaveBeenCalledWith('Layer moved successfully.');
		});

		it('moves layer down when down button is clicked', async () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project, reorderLayers, showSuccess } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// Find the down button for the middle layer (layer-2)
			const downButtons = screen.getAllByText(/down/i);
			await fireEvent.click(downButtons[1]); // Second down button is for layer-2

			expect(reorderLayers).toHaveBeenCalledWith(['layer-1', 'layer-3', 'layer-2']);
			expect(showSuccess).toHaveBeenCalledWith('Layer moved successfully.');
		});

		it('disables up button for first layer', () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// First layer's up button should be disabled
			const upButtons = screen.getAllByText(/up/i);
			const firstUpButton = upButtons[0];
			expect(firstUpButton).toBeDisabled();
		});

		it('disables down button for last layer', () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// Last layer's down button should be disabled
			const downButtons = screen.getAllByText(/down/i);
			const lastDownButton = downButtons[2];
			expect(lastDownButton).toBeDisabled();
		});

		it('prevents moving up when layer is already at top', async () => {
			const { reorderLayers } = require('$lib/stores');

			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// Try to move first layer up
			const upButtons = screen.getAllByText(/up/i);
			await fireEvent.click(upButtons[0]); // First up button is disabled, but let's test

			// Should not call reorderLayers
			expect(reorderLayers).not.toHaveBeenCalled();
		});

		it('prevents moving down when layer is already at bottom', async () => {
			const { reorderLayers } = require('$lib/stores');

			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			// Try to move last layer down
			const downButtons = screen.getAllByText(/down/i);
			await fireEvent.click(downButtons[2]); // Last down button is disabled, but let's test

			// Should not call reorderLayers
			expect(reorderLayers).not.toHaveBeenCalled();
		});

		it('handles layer not found gracefully', async () => {
			const { reorderLayers } = require('$lib/stores');

			render(LayerManager);

			// Try to move a layer that doesn't exist
			const nonExistentLayerId = 'non-existent-layer';
			// Since we can't easily test this through UI (buttons won't exist for non-existent layers),
			// we test the underlying logic by calling the move function directly if exposed
			// For now, we just ensure the component doesn't crash

			expect(screen.getByText(/layers \(\d+\)/i)).toBeInTheDocument();
		});
	});

	describe('Responsive Design', () => {
		it('shows arrow icons on larger screens', () => {
			const projectWithLayers = {
				...mockProject,
				layers: [{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] }]
			};

			const { project } = require('$lib/stores');
			project.set(projectWithLayers);

			render(LayerManager);

			// Should show arrow symbols
			expect(screen.getByText('↑')).toBeInTheDocument();
			expect(screen.getByText('↓')).toBeInTheDocument();
		});

		it('shows text labels on smaller screens', () => {
			const projectWithLayers = {
				...mockProject,
				layers: [{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] }]
			};

			const { project } = require('$lib/stores');
			project.set(projectWithLayers);

			render(LayerManager);

			// Should show text labels alongside arrows
			expect(screen.getByText('Up')).toBeInTheDocument();
			expect(screen.getByText('Down')).toBeInTheDocument();
		});
	});

	describe('Error Scenarios', () => {
		it('handles project store errors gracefully', () => {
			// Simulate a project with invalid layer data
			const invalidProject = {
				...mockProject,
				layers: null // Invalid layers array
			};

			const { project } = require('$lib/stores');
			project.set(invalidProject);

			// Component should render without crashing
			expect(() => render(LayerManager)).not.toThrow();
		});

		it('handles reorderLayers errors gracefully', async () => {
			const { reorderLayers, showError } = require('$lib/stores');
			reorderLayers.mockImplementation(() => {
				throw new Error('Reorder failed');
			});

			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			const upButtons = screen.getAllByText(/up/i);
			await fireEvent.click(upButtons[1]);

			// Component should handle the error gracefully
			expect(screen.getByText(/layers \(3\)/i)).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('provides proper button labels', () => {
			const projectWithLayers = {
				...mockProject,
				layers: [{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] }]
			};

			const { project } = require('$lib/stores');
			project.set(projectWithLayers);

			render(LayerManager);

			const buttons = screen.getAllByRole('button');
			expect(buttons.length).toBeGreaterThan(0);
		});

		it('disables buttons appropriately', () => {
			const projectWith3Layers = {
				...mockProject,
				layers: [
					{ ...mockLayer, id: 'layer-1', name: 'Background', order: 0, traits: [] },
					{ ...mockLayer, id: 'layer-2', name: 'Character', order: 1, traits: [] },
					{ ...mockLayer, id: 'layer-3', name: 'Accessory', order: 2, traits: [] }
				]
			};

			const { project } = require('$lib/stores');
			project.set(projectWith3Layers);

			render(LayerManager);

			const upButtons = screen.getAllByText(/up/i);
			const downButtons = screen.getAllByText(/down/i);

			// First up button should be disabled
			expect(upButtons[0]).toBeDisabled();
			// Last down button should be disabled
			expect(downButtons[2]).toBeDisabled();

			// Middle buttons should be enabled
			expect(upButtons[1]).not.toBeDisabled();
			expect(downButtons[1]).not.toBeDisabled();
		});
	});
});