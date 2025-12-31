import type { Handle } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

// Generate a CSP nonce for each request
function generateNonce(): string {
	return randomUUID();
}

export const handle: Handle = async ({ event, resolve }) => {
	// Generate a nonce for this request
	const nonce = generateNonce();
	event.locals.nonce = nonce;

	// Build CSP with nonce
	const CSP_HEADER = `
		default-src 'self';
		script-src 'self' 'nonce-${nonce}';
		style-src 'self' 'nonce-${nonce}';
		img-src 'self' data: blob:;
		font-src 'self' data:;
		connect-src 'self';
		media-src 'self';
		object-src 'none';
		base-uri 'self';
		form-action 'self';
		frame-ancestors 'none';
		upgrade-insecure-requests;
		block-all-mixed-content;
		require-trusted-types-for 'script';
	`
		.replace(/\s{2,}/g, ' ')
		.trim();

	const response = await resolve(event);

	// Security Headers
	response.headers.set('Content-Security-Policy', CSP_HEADER);
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

	return response;
};
