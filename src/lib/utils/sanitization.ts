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
 * Check if Trusted Types is available and enabled
 */
export function isTrustedTypesSupported(): boolean {
	return (
		'trustedTypes' in window &&
		typeof (window as unknown as { trustedTypes?: { createPolicy: unknown } }).trustedTypes
			?.createPolicy === 'function'
	);
}

/**
 * Create a Trusted Types policy (if supported)
 * This should be called early in the application lifecycle
 */
export function initTrustedTypesPolicy(): void {
	if (isTrustedTypesSupported()) {
		(
			window as unknown as {
				trustedTypes: { createPolicy: (name: string, rules: Record<string, unknown>) => void };
			}
		).trustedTypes.createPolicy('default', {
			createHTML: (htmlString: string) => {
				return sanitizeHTML(htmlString);
			},
			createScript: () => {
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
