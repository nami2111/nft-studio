import { initOrbiter } from '@junobuild/analytics';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event }) => {
	if (import.meta.env.DEV) {
		console.error(error, event);
	}
};

// Initialize Juno Analytics - disabled in development
if (import.meta.env.PROD) {
	try {
		initOrbiter({
			satelliteId: 'dpl4s-kqaaa-aaaal-asg3a-cai',
			orbiterId: 'p2pi7-hiaaa-aaaal-asaia-cai'
		});
	} catch (err) {
		// Silently fail if Orbiter permissions are not configured
		console.warn('Orbiter analytics initialization failed:', err);
	}
}
