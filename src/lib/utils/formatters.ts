/**
 * Common formatting utilities for the NFT Studio.
 * Provides consistent formatting for dates, file sizes, and durations.
 *
 * @module formatters
 */

/**
 * Format a file size in bytes to human readable format (KB, MB, GB).
 *
 * @param bytes - The size in bytes.
 * @returns Formatted string (e.g., "1.23 MB", "456 KB").
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format a duration in milliseconds to human readable format.
 *
 * @param ms - Duration in milliseconds.
 * @returns Formatted string (e.g., "1.2s", "450ms", "2m 30s").
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3_600_000) {
		const minutes = Math.floor(ms / 60_000);
		const seconds = Math.floor((ms % 60_000) / 1000);
		return `${minutes}m ${seconds}s`;
	}
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);
	return `${hours}h ${minutes}m`;
}

/**
 * Format a Date object or timestamp to a short readable date string.
 *
 * @param date - Date object, timestamp, or ISO date string.
 * @returns Formatted date string (e.g., "12/1/2025").
 */
export function formatDate(date: Date | number | string): string {
	const d = date instanceof Date ? date : new Date(date);
	return d.toLocaleDateString();
}

/**
 * Format a Date object or timestamp to time string.
 *
 * @param date - Date object, timestamp, or ISO date string.
 * @returns Formatted time string (e.g., "3:45:30 PM").
 */
export function formatTime(date: Date | number | string): string {
	const d = date instanceof Date ? date : new Date(date);
	return d.toLocaleTimeString();
}

/**
 * Format a Date object or timestamp to a detailed date and time string.
 *
 * @param date - Date object, timestamp, or ISO date string.
 * @returns Formatted string (e.g., "12/1/2025, 3:45:30 PM").
 */
export function formatDateTime(date: Date | number | string): string {
	const d = date instanceof Date ? date : new Date(date);
	return `${d.toLocaleDateString()}, ${d.toLocaleTimeString()}`;
}

/**
 * Format a number with commas as thousands separators.
 *
 * @param num - Number to format.
 * @returns Formatted string (e.g., "1,234,567").
 */
export function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Format a percentage value with specified decimal places.
 *
 * @param value - Decimal value (e.g., 0.85 for 85%).
 * @param decimals - Number of decimal places (default: 1).
 * @returns Formatted percentage string (e.g., "85.0%").
 */
export function formatPercentage(value: number, decimals: number = 1): string {
	return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a memory usage value in bytes to a short readable format.
 * Similar to formatFileSize but optimized for memory display in UIs.
 *
 * @param bytes - Memory usage in bytes.
 * @returns Formatted string (e.g., "256 MB", "1.2 GB").
 */
export function formatMemory(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
