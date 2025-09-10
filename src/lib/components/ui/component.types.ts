/**
 * Standardized component prop interfaces and types for the UI library.
 *
 * @module component.types
 */

import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Base component props that all components should extend.
 */
export interface BaseComponentProps {
	/** Additional CSS classes to apply to the component */
	class?: string;
	/** Unique identifier for the component */
	id?: string;
	/** Whether the component is disabled */
	disabled?: boolean;
	/** Whether the component is read-only */
	readonly?: boolean;
}

/**
 * Props for components that support keyboard navigation.
 */
export interface KeyboardNavigableProps {
	/** Tab index for keyboard navigation */
	tabindex?: number;
	/** Keyboard shortcut to activate the component */
	accesskey?: string;
}

/**
 * Props for form components.
 */
export interface FormComponentProps extends BaseComponentProps, KeyboardNavigableProps {
	/** Name of the form field */
	name?: string;
	/** Value of the form field */
	value?: string | number | boolean;
	/** Whether the field is required */
	required?: boolean;
	/** Placeholder text */
	placeholder?: string;
	/** Error message to display */
	error?: string;
}

/**
 * Props for components that can have children content.
 */
export interface WithChildrenProps {
	/** Content to render inside the component */
	children?: Snippet;
}

/**
 * Props for components that support custom styling.
 */
export interface StyleableProps {
	/** Inline styles to apply to the component */
	style?: string;
}

/**
 * Props for components that can be focused.
 */
export interface FocusableProps {
	/** Whether the component should be focused on mount */
	autofocus?: boolean;
	/** Callback when component receives focus */
	onfocus?: (event: FocusEvent) => void;
	/** Callback when component loses focus */
	onblur?: (event: FocusEvent) => void;
}

/**
 * Props for components that support click events.
 */
export interface ClickableProps {
	/** Callback when component is clicked */
	onclick?: (event: MouseEvent) => void;
}

/**
 * Props for components that support keyboard events.
 */
export interface KeyboardProps {
	/** Callback when a key is pressed */
	onkeydown?: (event: KeyboardEvent) => void;
	/** Callback when a key is released */
	onkeyup?: (event: KeyboardEvent) => void;
	/** Callback when a key is pressed and released */
	onkeypress?: (event: KeyboardEvent) => void;
}

/**
 * Standardized props for interactive components.
 */
export interface InteractiveProps
	extends BaseComponentProps,
		KeyboardNavigableProps,
		FocusableProps,
		ClickableProps,
		KeyboardProps {}

/**
 * Standardized props for all HTML elements.
 */
export type HTMLProps<T extends HTMLElement> = HTMLAttributes<T>;

/**
 * Utility type to make all properties of an interface optional.
 */
export type Partial<T> = {
	[P in keyof T]?: T[P];
};
