/**
 * Test suite for Modal component.
 *
 * @module modal.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Modal from './modal.svelte';

// Mock lucide icons
vi.mock('lucide-svelte', () => ({
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

		// Ensure window properties exist (jsdom setup should handle this)
		if (typeof window.innerHeight === 'undefined') {
			Object.defineProperty(window, 'innerHeight', {
				writable: true,
				configurable: true,
				value: 800
			});
		}

		if (typeof window.addEventListener === 'undefined') {
			Object.defineProperty(window, 'addEventListener', {
				writable: true,
				value: vi.fn()
			});
		}

		if (typeof window.removeEventListener === 'undefined') {
			Object.defineProperty(window, 'removeEventListener', {
				writable: true,
				value: vi.fn()
			});
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Basic Rendering', () => {
		it('does not render when open is false', () => {
			render(Modal, {
				props: {
					open: false,
					onClose,
					title: 'Test Modal',
					children: 'Modal content'
				}
			});

			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
		});

		it('renders when open is true', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Modal content'
				}
			});

			expect(screen.getByRole('dialog')).toBeInTheDocument();
			expect(screen.getByText('Test Modal')).toBeInTheDocument();
			expect(screen.getByText('Modal content')).toBeInTheDocument();
		});

		it('renders with custom max width', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content',
					maxWidth: 'max-w-4xl'
				}
			});

			const modal = screen.getByRole('dialog').querySelector('[class*="max-w-4xl"]');
			expect(modal).toBeInTheDocument();
		});

		it('renders with custom CSS classes', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content',
					class: 'custom-modal-class'
				}
			});

			const modal = screen.getByRole('dialog').querySelector('.custom-modal-class');
			expect(modal).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('has correct ARIA attributes', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const dialog = screen.getByRole('dialog');
			expect(dialog).toHaveAttribute('aria-modal', 'true');
			expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
		});

		it('has proper title association', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const title = screen.getByRole('heading', { level: 2 });
			expect(title).toHaveAttribute('id', 'modal-title');
		});

		it('has close button with proper aria-label', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const closeButton = screen.getByLabelText('Close modal');
			expect(closeButton).toBeInTheDocument();
		});

		it('focuses first focusable element when opened', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: `
						<button>First Button</button>
						<button>Second Button</button>
						<input type="text" placeholder="Input field" />
					`
				}
			});

			// Wait for focus management to kick in
			await waitFor(() => {
				const firstButton = screen.getByText('First Button');
				expect(firstButton).toHaveFocus();
			});
		});
	});

	describe('Closing Behavior', () => {
		it('calls onClose when close button is clicked', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const closeButton = screen.getByLabelText('Close modal');
			await fireEvent.click(closeButton);

			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('calls onClose when overlay is clicked', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const overlay = screen.getByRole('dialog');
			await fireEvent.click(overlay);

			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('calls onClose when Escape key is pressed', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const dialog = screen.getByRole('dialog');
			await fireEvent.keyDown(dialog, { key: 'Escape' });

			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('does not call onClose when other keys are pressed', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const dialog = screen.getByRole('dialog');
			await fireEvent.keyDown(dialog, { key: 'Enter' });

			expect(onClose).not.toHaveBeenCalled();
		});

		it('does not call onClose when modal content is clicked', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: '<button>Modal Button</button>'
				}
			});

			const modalButton = screen.getByText('Modal Button');
			await fireEvent.click(modalButton);

			expect(onClose).not.toHaveBeenCalled();
		});
	});

	describe('Body Scroll Management', () => {
		it('prevents body scroll when modal is open', () => {
			const mockBodyStyle = {};
			Object.defineProperty(document.body, 'style', {
				value: mockBodyStyle,
				writable: true
			});

			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			expect(mockBodyStyle.overflow).toBe('hidden');
		});

		it('restores body scroll when modal is closed', async () => {
			const mockBodyStyle = { overflow: 'hidden' };
			Object.defineProperty(document.body, 'style', {
				value: mockBodyStyle,
				writable: true
			});

			const { rerender } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			// Close the modal
			await rerender({
				open: false,
				onClose,
				title: 'Test Modal',
				children: 'Content'
			});

			expect(mockBodyStyle.overflow).toBe('');
		});
	});

	describe('Viewport and Responsive Behavior', () => {
		it('handles viewport changes for mobile', async () => {
			const mockModalElement = {
				offsetHeight: 600,
				style: {
					marginTop: '',
					maxHeight: '',
					overflowY: ''
				}
			};

			// Mock mobile viewport
			Object.defineProperty(window, 'visualViewport', {
				writable: true,
				value: {
					height: 600, // Mobile viewport height
					addEventListener: vi.fn(),
					removeEventListener: vi.fn()
				}
			});

			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			// The modal should handle viewport changes without errors
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('handles viewport changes for desktop', async () => {
			// Mock desktop viewport
			Object.defineProperty(window, 'visualViewport', {
				writable: true,
				value: {
					height: 1080, // Desktop viewport height
					addEventListener: vi.fn(),
					removeEventListener: vi.fn()
				}
			});

			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			// The modal should handle viewport changes without errors
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('falls back to window resize when Visual Viewport API is not available', () => {
			// Remove Visual Viewport API
			Object.defineProperty(window, 'visualViewport', {
				writable: true,
				value: undefined
			});

			const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});

	describe('Event Listeners Management', () => {
		it('sets up event listeners on mount', () => {
			const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
		});

		it('removes event listeners on unmount', () => {
			const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

			const { unmount } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			unmount();

			expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
		});

		it('removes event listeners when Visual Viewport API is available', () => {
			const removeEventListenerSpy = vi.spyOn(window.visualViewport, 'removeEventListener');

			const { unmount } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			unmount();

			expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});

	describe('Content Rendering', () => {
		it('renders complex content correctly', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Complex Modal',
					children: `
						<div>
							<h3>Section Title</h3>
							<p>Some paragraph content</p>
							<button>Action Button</button>
							<input type="text" placeholder="Type here..." />
						</div>
					`
				}
			});

			expect(screen.getByText('Section Title')).toBeInTheDocument();
			expect(screen.getByText('Some paragraph content')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
			expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
		});

		it('preserves HTML attributes passed to modal', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content',
					'data-testid': 'custom-modal',
					role: 'alertdialog'
				}
			});

			const modal = screen.getByTestId('custom-modal');
			expect(modal).toBeInTheDocument();
			expect(modal).toHaveAttribute('role', 'alertdialog');
		});
	});

	describe('Keyboard Navigation', () => {
		it('prevents default on Escape key', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			const dialog = screen.getByRole('dialog');
			const preventDefaultSpy = vi.fn();

			await fireEvent.keyDown(dialog, {
				key: 'Escape',
				preventDefault: preventDefaultSpy
			});

			expect(preventDefaultSpy).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});

		it('focuses first focusable element after opening', async () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: `
						<div>
							<button>Button 1</button>
							<input type="text" />
							<button>Button 2</button>
						</div>
					`
				}
			});

			// Wait for the setTimeout in focusModal to execute
			await waitFor(
				() => {
					const firstButton = screen.getByText('Button 1');
					expect(firstButton).toHaveFocus();
				},
				{ timeout: 100 }
			);
		});
	});

	describe('Error Scenarios', () => {
		it('handles missing focusable elements gracefully', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: '<div>No focusable elements here</div>'
				}
			});

			// Should not throw an error
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		it('handles empty content gracefully', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Empty Modal',
					children: ''
				}
			});

			expect(screen.getByRole('dialog')).toBeInTheDocument();
			expect(screen.getByText('Empty Modal')).toBeInTheDocument();
		});

		it('handles null content gracefully', () => {
			render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Null Content Modal',
					children: null
				}
			});

			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});
	});

	describe('Cleanup', () => {
		it('restores body scroll on component destroy', () => {
			const mockBodyStyle = { overflow: 'hidden' };
			Object.defineProperty(document.body, 'style', {
				value: mockBodyStyle,
				writable: true
			});

			const { unmount } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			unmount();

			expect(mockBodyStyle.overflow).toBe('');
		});

		it('removes all event listeners on destroy', () => {
			const documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
			const windowRemoveSpy = vi.spyOn(window, 'removeEventListener');

			const { unmount } = render(Modal, {
				props: {
					open: true,
					onClose,
					title: 'Test Modal',
					children: 'Content'
				}
			});

			unmount();

			expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
			expect(windowRemoveSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});
});
