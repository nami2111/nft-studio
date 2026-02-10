import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import StrictPair from './StrictPair.svelte';
import { createMockProject, mockLayer } from '../test-utils';
import type { StrictPairConfig } from '$lib/types/layer';

// Mock Lucide icons
vi.mock('lucide-svelte', () => ({
	Settings: () => null,
	Plus: () => null,
	X: () => null,
	Info: () => null
}));

describe('StrictPair', () => {
	let mockProject: any;
	let onUpdateSpy: any;

	beforeEach(() => {
		// Create layers
		const layer1 = { ...mockLayer, id: 'layer-1', name: 'Layer 1', traits: [{ id: 't1' }] };
		const layer2 = { ...mockLayer, id: 'layer-2', name: 'Layer 2', traits: [{ id: 't2' }] };
		const layer3 = { ...mockLayer, id: 'layer-3', name: 'Layer 3', traits: [{ id: 't3' }] };

		mockProject = {
			...createMockProject(),
			layers: [layer1, layer2, layer3],
			strictPairConfig: {
				enabled: true,
				layerCombinations: []
			} as StrictPairConfig
		};

		onUpdateSpy = vi.fn();
	});

	it('should enable "Add Layer Combination" button in modal when 2 layers are selected', async () => {
		render(StrictPair, {
			props: {
				project: mockProject,
				onupdateStrictPairConfig: onUpdateSpy
			}
		});

		// 1. Open the modal
		const addBtn = screen.getByRole('button', { name: /Add Layer Combination/i });
		await fireEvent.click(addBtn);

		// Wait for modal to open
		await waitFor(() => expect(screen.getByText('Select 2 or More Layers')).toBeVisible());

		// 2. Select layers by clicking the list items (which have role="button")
		// We use strict name matching to ensure we get the right element
		const layer1Option = screen.getByRole('button', { name: /Select Layer 1 layer/i });
		const layer2Option = screen.getByRole('button', { name: /Select Layer 2 layer/i });

		// Use fireEvent.click which works even with Svelte 5 if the element is correct
		await fireEvent.click(layer1Option);
		await fireEvent.click(layer2Option);

		// 3. Find the submit button inside modal
		// There are multiple "Add Layer Combination" buttons now.
		// We can distinguish them by where they are or just take the last one
		const buttons = screen.getAllByRole('button', { name: /Add Layer Combination/i });
		const modalSubmitBtn = buttons[buttons.length - 1];

		// Debug: Log the disabled state if expectation fails
		if (modalSubmitBtn.hasAttribute('disabled')) {
			console.log('Button is still disabled!');
		}

		// Verify it's enabled
		expect(modalSubmitBtn).not.toBeDisabled();

		// 4. Submit
		await fireEvent.click(modalSubmitBtn);

		// 5. Verify update
		expect(onUpdateSpy).toHaveBeenCalled();
		const callArgs = onUpdateSpy.mock.calls[0][0];
		expect(callArgs.layerCombinations.length).toBe(1);
	});
});
