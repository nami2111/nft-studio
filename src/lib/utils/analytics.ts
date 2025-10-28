import { trackEvent } from '@junobuild/analytics';

/**
 * Simple analytics utility for NFT Studio
 * Uses Juno Analytics for privacy-compliant tracking
 */

/**
 * Track a custom analytics event
 * @param name The event name
 * @param metadata Additional event metadata (strings only)
 */
export function trackAnalyticsEvent(name: string, metadata?: Record<string, string>): void {
	// Only track in production
	if (!import.meta.env.PROD) return;

	try {
		trackEvent({
			name,
			metadata
		});
	} catch (error) {
		console.warn('Failed to track analytics event:', error);
	}
}

/**
 * Track NFT generation completion
 * @param collectionSize The size of the generated collection
 * @param durationSeconds The time taken to generate in seconds
 */
export function trackGenerationCompleted(collectionSize: number, durationSeconds: number): void {
	trackAnalyticsEvent('generation_completed', {
		collection_size: collectionSize.toString(),
		duration_seconds: durationSeconds.toString()
	});
}

/**
 * Track Gallery Mode page visit
 */
export function trackGalleryPageVisit(): void {
	trackAnalyticsEvent('gallery_page_visit');
}
