/**
 * Test suite for Modal component.
 *
 * @module modal.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from './modal.svelte';

// Mock lucide icons
vi.mock('lucide-svelte', () => ({
	X: { render: () => '<span data-testid="close-icon">X</span>' },
	XIcon: { render: () => '<span data-testid="close-icon">X</span>' }
}));

// Mock utils
vi.mock('$lib/utils', () => ({
	cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}));

describe('Modal', () => {
	let onClose: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onClose = vi.fn();
		vi.clearAllMocks();


		// Mock window dimensions
		Object.defineProperty(window, 'innerHeight', {
			writable: true,
			configurable: true,
			value: 800
		});

		// Mock Visual Viewport safely
		if (!window.visualViewport) {
			// If not defined, define it
			const visualViewportMock = {
				height: 800,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				width: 1024,
				offsetLeft: 0,
				offsetTop: 0,
				pageLeft: 0,
				pageTop: 0,
				scale: 1,
				// Add dispatchEvent for EventTarget compatibility if needed, though simple mock usually suffices for component checks
				dispatchEvent: vi.fn(),
			};

			Object.defineProperty(window, 'visualViewport', {
				writable: true,
				configurable: true,
				value: visualViewportMock
			});
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Basic Rendering', () => {
		it('renders when open is true', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
				}
			});

			expect(screen.getByRole('dialog')).toBeInTheDocument();
			// Title should be visible
			expect(screen.getByText('Test Modal')).toBeInTheDocument();
		});

		it('calls onClose when close button is clicked', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
				}
			});

			const closeButton = screen.getByLabelText('Close modal');
			await fireEvent.click(closeButton);

			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('calls onClose when Escape key is pressed', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
				}
			});

			const dialog = screen.getByRole('dialog');

			await fireEvent.keyDown(dialog, { key: 'Escape' });

			expect(onClose).toHaveBeenCalled();
		});

		it('removes event listeners when Visual Viewport API is available', () => {
			// Access the mocked object directly to spy on it
			const removeEventListenerSpy = vi.spyOn(window.visualViewport!, 'removeEventListener');

			const { unmount } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
				}
			});

			unmount();

			// Correct assertion: component calls removeEventListener on window.visualViewport
			expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});
});
