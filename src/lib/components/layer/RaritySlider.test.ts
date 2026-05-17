import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { render, screen, cleanup } from '@testing-library/svelte';
import RaritySlider from './RaritySlider.svelte';
import { updateTraitRarity } from '$lib/stores';
import { createLayerId, createTraitId } from '$lib/types/ids';

// Mock the updateTraitRarity function
vi.mock('$lib/stores', () => ({
	updateTraitRarity: vi.fn()
}));

describe('RaritySlider', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});
	const mockLayerId = 'layer-1';
	const mockTraitId = 'trait-1';
	const layerIdTyped = createLayerId(mockLayerId);
	const traitIdTyped = createTraitId(mockTraitId);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders with correct initial value', () => {
		render(RaritySlider, {
			props: {
				rarityWeight: 3,
				traitId: mockTraitId,
				layerId: mockLayerId
			}
		});

		expect(screen.getByTestId('rarity-value')).toHaveTextContent('Epic');
		expect(screen.getByTestId('rarity-slider')).toHaveAttribute('data-rarity', '3');
	});

	it('displays key rarity level labels', () => {
		render(RaritySlider, {
			props: {
				rarityWeight: 1,
				traitId: mockTraitId,
				layerId: mockLayerId
			}
		});

		// Check for the main labels we kept
		expect(screen.getAllByText('Mythic').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Common').length).toBeGreaterThan(0);
	});

	it('shows correct label for each rarity value', () => {
		const testCases = [
			{ input: 1, expected: 'Mythic' },
			{ input: 2, expected: 'Legendary' },
			{ input: 3, expected: 'Epic' },
			{ input: 4, expected: 'Rare' },
			{ input: 5, expected: 'Common' }
		];

		testCases.forEach(({ input, expected }, index) => {
			const { container } = render(RaritySlider, {
				props: {
					rarityWeight: input,
					traitId: `${mockTraitId}-${index}`,
					layerId: mockLayerId
				}
			});

			// Check that the main rarity label shows the expected value
			const rarityValue = container.querySelector('[data-testid="rarity-value"]');
			expect(rarityValue?.textContent).toContain(expected);
		});
	});

	it('handles edge cases for rarity values', () => {
		// Test with value below minimum
		const { container: container1 } = render(RaritySlider, {
			props: {
				rarityWeight: 0,
				traitId: `${mockTraitId}-edge-1`,
				layerId: mockLayerId
			}
		});
		const rarityValue1 = container1.querySelector('[data-testid="rarity-value"]');
		expect(rarityValue1?.textContent).toContain('Mythic');

		// Test with value above maximum
		const { container: container2 } = render(RaritySlider, {
			props: {
				rarityWeight: 6,
				traitId: `${mockTraitId}-edge-2`,
				layerId: mockLayerId
			}
		});
		const rarityValue2 = container2.querySelector('[data-testid="rarity-value"]');
		expect(rarityValue2?.textContent).toContain('Common');

		// Test with non-integer value
		const { container: container3 } = render(RaritySlider, {
			props: {
				rarityWeight: 2.7,
				traitId: `${mockTraitId}-edge-3`,
				layerId: mockLayerId
			}
		});
		const rarityValue3 = container3.querySelector('[data-testid="rarity-value"]');
		expect(rarityValue3?.textContent).toContain('Epic');
	});
});
