import { initOrbiter } from '@junobuild/analytics';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event }) => {
	console.error(error, event);
};

// Initialize Juno Analytics - disabled in development
if (import.meta.env.PROD) {
	initOrbiter({
		satelliteId: 'dpl4s-kqaaa-aaaal-asg3a-cai',
		orbiterId: 'p2pi7-hiaaa-aaaal-asaia-cai'
	});
}