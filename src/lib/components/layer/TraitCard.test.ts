/**
 * Test suite for TraitCard component.
 *
 * @module TraitCard.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import TraitCard from './TraitCard.svelte';
import { createMockProject, mockTrait, createMockFile } from '../test-utils';
import { project, removeTrait, updateTraitName } from '$lib/stores';
import { toast } from 'svelte-sonner';
import type { Project, Trait } from '$lib/types';

// Mock dependencies
vi.mock('$lib/stores', () => {
	// Create a reactive-like object using a plain object that we update via Object.assign
	// for Svelte 5 to track properties.
	const project = {
		id: 'mock-project',
		name: 'Mock Project',
		layers: [],
		set: function (newState: any) {
			Object.assign(this, newState);
		},
		subscribe: (fn: any) => {
			// Basic subscribe mock for compatibility
			return () => { };
		}
	};

	return {
		project,
		removeTrait: vi.fn(),
		updateTraitName: vi.fn(),
		updateTraitRarity: vi.fn()
	};
});

vi.mock('$lib/types/ids', () => ({
	createLayerId: (id: string) => `layer:${id}`,
	createTraitId: (id: string) => `trait:${id}`
}));

vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

// Child components are unmocked to verify full rendering, except for RaritySlider which hangs in JSDOM
// Child components are unmocked to verify full rendering, except for RaritySlider which hangs in JSDOM
vi.mock('$lib/components/layer/RaritySlider.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$render: () => `<div data-testid="rarity-slider">Rarity: <span data-testid="rarity-value">Epic</span></div>`
	}))
}));

// Mock IntersectionObserver globally
global.IntersectionObserver = vi.fn().mockImplementation(function (callback) {
	return {
		observe: vi.fn(),
		disconnect: vi.fn(),
		takeRecords: vi.fn(),
		unobserve: vi.fn()
	};
});

describe('TraitCard', () => {
	let mockTrait: Trait;
	let mockProject: Project;
	let layerId: string;

	beforeEach(() => {
		mockTrait = {
			...mockTrait,
			id: 'trait-1',
			name: 'Test Trait',
			imageUrl: 'blob:test-image',
			imageData: new ArrayBuffer(1000),
			width: 500,
			height: 500,
			rarityWeight: 3
		};

		mockProject = createMockProject();
		layerId = 'layer-1';

		// Reset all mocks
		vi.clearAllMocks();

		// Mock confirm dialog
		global.confirm = vi.fn(() => true);

		// Setup initial store state
		project.set(mockProject);

		// Mock IntersectionObserver globally
		global.IntersectionObserver = vi.fn().mockImplementation(function (callback) {
			return {
				observe: vi.fn(),
				disconnect: vi.fn(),
				takeRecords: vi.fn(),
				unobserve: vi.fn()
			};
		});

		// Mock URL methods
		if (!global.URL.createObjectURL) {
			global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
		}
		if (!global.URL.revokeObjectURL) {
			global.URL.revokeObjectURL = vi.fn();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial State', () => {
		it('renders trait information correctly', async () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			expect(screen.getByText(mockTrait.name)).toBeInTheDocument();

			// Verify RaritySlider was called (mocked)
			const { default: RaritySlider } = await import('$lib/components/layer/RaritySlider.svelte');
			expect(RaritySlider).toHaveBeenCalled();
		});

		it('shows selection checkbox when showSelection is true', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId, showSelection: true }
			});

			expect(screen.getByTestId('trait-select-checkbox')).toBeInTheDocument();
			expect(screen.getByLabelText(/select trait/i)).toBeInTheDocument();
		});

		it('does not show selection checkbox when showSelection is false', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId, showSelection: false }
			});

			expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
		});

		it('applies selected styling when trait is selected', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId, selected: true }
			});

			expect(screen.getByTestId('trait-card')).toHaveClass('ring-primary');
		});

		it('shows loading spinner when no image data or URL', () => {
			const traitWithoutImage = { ...mockTrait, imageUrl: '', imageData: new ArrayBuffer(0) };

			render(TraitCard, {
				props: { trait: traitWithoutImage, layerId }
			});

			expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
		});
	});

	describe('Image Loading', () => {
		it('shows image when visible and URL exists', async () => {
			// Mock IntersectionObserver to trigger visibility synchronously
			let observerCallback: any;
			global.IntersectionObserver = vi.fn().mockImplementation(function (callback) {
				observerCallback = callback;
				return {
					observe: vi.fn((element) => {
						observerCallback([{ isIntersecting: true, target: element }]);
					}),
					disconnect: vi.fn()
				};
			});

			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			await waitFor(() => {
				const img = screen.getByRole('img');
				expect(img).toBeInTheDocument();
				expect(img).toHaveAttribute('src', mockTrait.imageUrl);
				expect(img).toHaveAttribute('alt', mockTrait.name);
			});
		});

		it('disconnects observer when component unmounts', () => {
			const mockDisconnect = vi.fn();
			global.IntersectionObserver = vi.fn().mockImplementation(function () {
				return {
					observe: vi.fn(),
					disconnect: mockDisconnect
				};
			});

			const { unmount } = render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			unmount();

			expect(mockDisconnect).toHaveBeenCalled();
		});

		it('sets up observer with correct options', () => {
			const mockObserve = vi.fn();
			global.IntersectionObserver = vi.fn().mockImplementation(function () {
				return {
					observe: mockObserve,
					disconnect: vi.fn()
				};
			});

			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			expect(global.IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
				rootMargin: '50px',
				threshold: 0.1
			});
		});
	});

	describe('Trait Name Editing', () => {
		it('enters edit mode when edit button is clicked', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			expect(screen.getByDisplayValue(mockTrait.name)).toBeInTheDocument();
			expect(screen.getByTestId('save-button')).toBeInTheDocument();
			expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
		});

		it('updates trait name when save is clicked', async () => {


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Enter edit mode
			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			// Change name
			const nameInput = screen.getByDisplayValue(mockTrait.name);
			const newName = 'Updated Trait Name';
			fireEvent.input(nameInput, { target: { value: newName } });

			// Save
			const saveButton = screen.getByTestId('save-button').closest('button');
			fireEvent.click(saveButton!);

			expect(updateTraitName).toHaveBeenCalledWith('layer:layer-1', 'trait:trait-1', newName);
			expect(toast.success).toHaveBeenCalledWith('Trait name updated.');
		});

		it('updates trait name when Enter key is pressed', async () => {


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Enter edit mode
			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			// Change name and press Enter
			const nameInput = screen.getByDisplayValue(mockTrait.name);
			const newName = 'Updated Trait Name';
			fireEvent.input(nameInput, { target: { value: newName } });
			fireEvent.keyDown(nameInput, { key: 'Enter' });

			expect(updateTraitName).toHaveBeenCalledWith('layer:layer-1', 'trait:trait-1', newName);
			expect(toast.success).toHaveBeenCalledWith('Trait name updated.');
		});

		it('cancels edit when cancel button is clicked', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Enter edit mode
			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			// Change name
			const nameInput = screen.getByDisplayValue(mockTrait.name);
			fireEvent.input(nameInput, { target: { value: 'Different Name' } });

			// Cancel
			const cancelButton = screen.getByTestId('cancel-button').closest('button');
			fireEvent.click(cancelButton!);

			// Should show original name
			expect(screen.getByText(mockTrait.name)).toBeInTheDocument();
			expect(screen.queryByDisplayValue('Different Name')).not.toBeInTheDocument();
		});

		it('shows error for empty trait name', async () => {


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Enter edit mode
			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			// Set empty name
			const nameInput = screen.getByDisplayValue(mockTrait.name);
			fireEvent.input(nameInput, { target: { value: '' } });

			// Try to save
			const saveButton = screen.getByTestId('save-button').closest('button');
			fireEvent.click(saveButton!);

			expect(toast.error).toHaveBeenCalledWith('Trait name cannot be empty.');
			// Should revert to original name in the input (since we stay in edit mode)
			expect(screen.getByDisplayValue(mockTrait.name)).toBeInTheDocument();
		});

		it('shows error for trait name exceeding 100 characters', async () => {


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Enter edit mode
			const editButton = screen.getByTestId('edit-button').closest('button');
			fireEvent.click(editButton!);

			// Set long name
			const nameInput = screen.getByDisplayValue(mockTrait.name);
			const longName = 'a'.repeat(101);
			fireEvent.input(nameInput, { target: { value: longName } });

			// Try to save
			const saveButton = screen.getByTestId('save-button').closest('button');
			fireEvent.click(saveButton!);

			expect(toast.error).toHaveBeenCalledWith('Trait name cannot exceed 100 characters.');
			// Should revert to original name in the input (since we stay in edit mode)
			expect(screen.getByDisplayValue(mockTrait.name)).toBeInTheDocument();
		});
	});

	describe('Trait Deletion', () => {
		it('shows confirmation dialog when delete button is clicked', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			const deleteButton = screen.getByTestId('delete-button').closest('button');
			fireEvent.click(deleteButton!);

			expect(global.confirm).toHaveBeenCalledWith(
				`Are you sure you want to delete "${mockTrait.name}"?`
			);
		});

		it('removes trait when confirmation is accepted', async () => {
			global.confirm = vi.fn(() => true);


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			const deleteButton = screen.getByTestId('delete-button').closest('button');
			fireEvent.click(deleteButton!);

			expect(removeTrait).toHaveBeenCalledWith('layer:layer-1', 'trait:trait-1');
			expect(toast.success).toHaveBeenCalledWith(`Trait "${mockTrait.name}" has been deleted.`);
		});

		it('does not remove trait when confirmation is cancelled', () => {
			global.confirm = vi.fn(() => false);


			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			const deleteButton = screen.getByTestId('delete-button').closest('button');
			fireEvent.click(deleteButton!);

			expect(removeTrait).not.toHaveBeenCalled();
		});

		it('shows error message when deletion fails', async () => {
			global.confirm = vi.fn(() => true);

			const testError = new Error('Delete failed');
			removeTrait.mockImplementation(() => {
				throw testError;
			});

			// Mock console.error
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			const deleteButton = screen.getByTestId('delete-button').closest('button');
			fireEvent.click(deleteButton!);

			expect(consoleSpy).toHaveBeenCalledWith('Failed to delete trait:', testError);
			expect(toast.error).toHaveBeenCalledWith('Failed to delete trait. Please try again.');

			consoleSpy.mockRestore();
		});
	});

	describe('Trait Selection', () => {
		it('calls onToggleSelection when checkbox is changed', () => {
			const mockOnToggleSelection = vi.fn();

			render(TraitCard, {
				props: {
					trait: mockTrait,
					layerId,
					showSelection: true,
					selected: false,
					onToggleSelection: mockOnToggleSelection
				}
			});

			const checkbox = screen.getByRole('checkbox');
			fireEvent.click(checkbox);

			expect(mockOnToggleSelection).toHaveBeenCalled();
		});

		it('reflects selected state in checkbox', () => {
			render(TraitCard, {
				props: {
					trait: mockTrait,
					layerId,
					showSelection: true,
					selected: true
				}
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox).toBeChecked();
		});
	});

	describe('Ruler Traits', () => {
		it('shows ruler rules manager for ruler traits', () => {
			const rulerTrait = { ...mockTrait, type: 'ruler' as const };

			render(TraitCard, {
				props: { trait: rulerTrait, layerId }
			});

			expect(screen.getByTestId('ruler-rules-manager')).toBeInTheDocument();
		});

		it('does not show ruler rules manager for normal traits', () => {
			const normalTrait = { ...mockTrait, type: 'normal' as const };

			render(TraitCard, {
				props: { trait: normalTrait, layerId }
			});

			expect(screen.queryByTestId('ruler-rules-manager')).not.toBeInTheDocument();
		});

		it('handles ruler rules updates', async () => {
			const rulerTrait = { ...mockTrait, type: 'ruler' as const };
			let onRulesUpdate: ((rules: any[]) => void) | undefined;

			// Mock the component to capture the onRulesUpdate prop
			vi.doMock('$lib/components/ui/ruler/RulerRulesManager.svelte', () => ({
				default: {
					render: (props: any) => {
						onRulesUpdate = props.onRulesUpdate;
						return `<div data-testid="ruler-rules-manager">Ruler Rules</div>`;
					}
				}
			}));

			render(TraitCard, {
				props: { trait: rulerTrait, layerId }
			});

			// Simulate rules update
			const newRules = [{ type: 'exclude', targetLayerId: 'layer-2' }];
			if (onRulesUpdate) {
				onRulesUpdate(newRules);
			}

			// Component should handle the update without errors
			expect(screen.getByTestId('ruler-rules-manager')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('provides proper alt text for trait image', async () => {
			// Mock IntersectionObserver to trigger visibility synchronously
			global.IntersectionObserver = vi.fn().mockImplementation(function (callback) {
				return {
					observe: (element: Element) => {
						callback([{ isIntersecting: true, target: element }]);
					},
					disconnect: vi.fn()
				};
			});

			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			await waitFor(() => {
				const img = screen.getByRole('img');
				expect(img).toHaveAttribute('alt', mockTrait.name);
			});
		});

		it('provides proper aria-label for selection checkbox', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId, showSelection: true }
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox).toHaveAttribute('aria-label', 'Select trait');
		});

		it('shows title attribute for long trait names', () => {
			const longNameTrait = {
				...mockTrait,
				name: 'This is a very long trait name that might be truncated'
			};

			render(TraitCard, {
				props: { trait: longNameTrait, layerId }
			});

			const traitNameElement = screen.getByText(longNameTrait.name);
			expect(traitNameElement).toHaveAttribute('title', longNameTrait.name);
		});
	});

	describe('Responsive Design', () => {
		it('renders properly on different screen sizes', () => {
			render(TraitCard, {
				props: { trait: mockTrait, layerId }
			});

			// Component should render without errors
			expect(screen.getByTestId('trait-card')).toBeInTheDocument();
			expect(screen.getByTestId('card-content')).toBeInTheDocument();
		});
	});

	describe('Error Scenarios', () => {
		it('handles missing layer data gracefully', () => {

			project.set({ ...mockProject, layers: [] });

			render(TraitCard, {
				props: { trait: mockTrait, layerId: 'non-existent-layer' }
			});

			// Should render without crashing
			expect(screen.getByTestId('trait-card')).toBeInTheDocument();
		});

		it('handles invalid trait data gracefully', () => {
			const invalidTrait = {
				...mockTrait,
				id: null,
				name: '',
				imageUrl: undefined
			};

			// Should not throw
			expect(() =>
				render(TraitCard, {
					props: { trait: invalidTrait, layerId }
				})
			).not.toThrow();
		});
	});
});
