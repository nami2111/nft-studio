/**
 * HTML sanitization utilities using DOMPurify
 * Provides safe HTML creation for XSS prevention
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string safe to use with innerHTML or {@html}
 */
export function sanitizeHTML(html: string): string {
	const config = {
		ALLOWED_TAGS: [
			'svg',
			'path',
			'rect',
			'circle',
			'polyline',
			'line',
			'div',
			'span',
			'p',
			'a',
			'button',
			'input',
			'label',
			'strong',
			'em',
			'small',
			'br'
		],
		ALLOWED_ATTR: [
			'class',
			'id',
			'style',
			'href',
			'type',
			'value',
			'd',
			'fill',
			'stroke',
			'stroke-width',
			'stroke-linecap',
			'stroke-linejoin',
			'viewBox',
			'rx',
			'ry',
			'cx',
			'cy',
			'r',
			'x',
			'y',
			'width',
			'height',
			'aria-hidden',
			'aria-label',
			'disabled'
		],
		FORCE_BODY: false,
		ALLOW_DATA_ATTR: false,
		ALLOW_UNKNOWN_PROTOCOLS: false
	};
	return DOMPurify.sanitize(html, config);
}

/**
 * Create safe SVG element from SVG string
 * @param svgString - SVG markup string
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svgString: string): string {
	const config = {
		ALLOWED_TAGS: ['svg', 'path', 'rect', 'circle', 'polyline', 'line', 'g', 'use'],
		ALLOWED_ATTR: [
			'class',
			'id',
			'style',
			'd',
			'fill',
			'stroke',
			'stroke-width',
			'stroke-linecap',
			'stroke-linejoin',
			'viewBox',
			'width',
			'height',
			'aria-hidden'
		],
		FORCE_BODY: false,
		ALLOW_DATA_ATTR: false,
		ALLOW_UNKNOWN_PROTOCOLS: false
	};
	return DOMPurify.sanitize(svgString, config);
}

/**
 * Create safe text content (no HTML allowed)
 * @param text - Plain text
 * @returns Text content with HTML entities escaped
 */
export function escapeText(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Create safe DOM elements using safe API (preferred over innerHTML)
 * @param tagName - HTML tag name
 * @param attributes - Object of attributes to set
 * @param children - Child elements or text content
 * @returns Sanitized DOM element
 */
export function createSafeElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	attributes: Record<string, string> = {},
	children: (HTMLElement | string)[] = []
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tagName);

	Object.entries(attributes).forEach(([key, value]) => {
		element.setAttribute(key, value);
	});

	children.forEach((child) => {
		if (typeof child === 'string') {
			element.appendChild(document.createTextNode(child));
		} else {
			element.appendChild(child);
		}
	});

	return element;
}

/**
 * Check if Trusted Types is available and enabled
 */
export function isTrustedTypesSupported(): boolean {
	return (
		'trustedTypes' in window && typeof (window as any).trustedTypes?.createPolicy === 'function'
	);
}

/**
 * Create a Trusted Types policy (if supported)
 * This should be called early in the application lifecycle
 */
export function initTrustedTypesPolicy(): void {
	if (isTrustedTypesSupported()) {
		(window as any).trustedTypes.createPolicy('default', {
			createHTML: (htmlString: string) => {
				return sanitizeHTML(htmlString);
			},
			createScript: (_scriptString: string) => {
				throw new Error('Script creation via Trusted Types is forbidden');
			},
			createScriptURL: (urlString: string) => {
				if (urlString.startsWith(window.location.origin)) {
					return urlString;
				}
				throw new Error('External script URLs are forbidden in Trusted Types');
			}
		});
	}
}
