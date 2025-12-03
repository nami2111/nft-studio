/**
 * Utility functions and type helpers for the NFT Studio.
 *
 * @module utils
 */

export interface ImageDimensions {
	width: number;
	height: number;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class strings, handling conditional classes.
 *
 * @param inputs - An array of class values (strings, objects, arrays, etc.).
 * @returns A merged class string safe for Tailwind.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Remove the `child` property from a type, if present.
 *
 * @template T - The original type.
 * @returns The type without the `child` key.
 */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;

/**
 * Remove the `children` property from a type, if present.
 *
 * @template T - The original type.
 * @returns The type without the `children` key.
 */
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;

/**
 * Remove both `child` and `children` properties from a type.
 *
 * a type with an optional element reference.
 *
 * @template T - Base type.
 * @template U - HTMLElement type (defaults to `HTMLElement`).
 * @returns The extended type with an optional `ref` property.
 */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Get the natural dimensions (width & height) of an image file.
 *
 * @param file - The image `File` object to inspect.
 * @returns A promise that resolves with the image's width and height.
 * @throws Will reject if the image cannot be loaded.
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			try {
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
			} finally {
				URL.revokeObjectURL(objectUrl);
			}
		};
		img.onerror = () => {
			try {
				URL.revokeObjectURL(objectUrl);
			} finally {
				reject(new Error('Failed to load image'));
			}
		};
		img.src = objectUrl;
	});
}

/**
 * Convert a File object to an ArrayBuffer with enhanced error handling.
 *
 * @param file - The File object to convert.
 * @param maxRetries - Maximum number of retry attempts (default: 3).
 * @param retryDelay - Delay between retries in milliseconds (default: 100).
 * @returns A promise that resolves with the ArrayBuffer representation of the file.
 */
export async function fileToArrayBuffer(
	file: File,
	maxRetries: number = 3,
	retryDelay: number = 100
): Promise<ArrayBuffer> {
	// Validate file object
	if (!file) {
		throw new Error('No file provided');
	}

	if (!file.name) {
		throw new Error('Invalid file: missing filename');
	}

	if (file.size === 0) {
		throw new Error(`File "${file.name}" is empty`);
	}

	if (file.size > 100 * 1024 * 1024) { // 100MB limit
		throw new Error(`File "${file.name}" is too large (max 100MB)`);
	}

	// Check if file is accessible
	if (typeof file.arrayBuffer !== 'function') {
		throw new Error(`File "${file.name}" is not accessible`);
	}

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			// Add a small delay to allow file handle to stabilize (especially for drag & drop)
			if (attempt > 1) {
				await new Promise(resolve => setTimeout(resolve, retryDelay));
			}

			const result = await file.arrayBuffer();
			
			if (result.byteLength === 0) {
				throw new Error(`File "${file.name}" read successfully but contains no data`);
			}

			return result;
			
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// If it's a NotFoundError and not the last attempt, retry
			if (
				lastError.name === 'NotFoundError' ||
				lastError.message.includes('NotFoundError') ||
				lastError.message.includes('could not be found')
			) {
				if (attempt < maxRetries) {
					continue;
				}
			}

			// For other errors or last attempt, throw with detailed context
			const errorContext = {
				fileName: file.name,
				fileSize: file.size,
				fileType: file.type,
				attempt,
				maxRetries,
				originalError: lastError.message
			};

			if (lastError.name === 'NotFoundError' || lastError.message.includes('could not be found')) {
				throw new Error(
					`Failed to access file "${file.name}". The file may have been moved, deleted, or is not accessible. ` +
					`Please try dragging the file again or select it using the file browser.`
				);
			}

			if (lastError.name === 'SecurityError' || lastError.message.includes('security')) {
				throw new Error(
					`Security error reading file "${file.name}". This may be due to browser security restrictions. ` +
					`Please try using the file browser instead of drag and drop.`
				);
			}

			if (lastError.name === 'AbortError' || lastError.message.includes('aborted')) {
				throw new Error(
					`File reading was aborted for "${file.name}". Please try again.`
				);
			}

			throw new Error(
				`Failed to read file "${file.name}": ${lastError.message} ` +
				`(attempt ${attempt}/${maxRetries})`
			);
		}
	}

	// This should never be reached, but just in case
	throw new Error(
		`Failed to read file "${file.name}" after ${maxRetries} attempts. ` +
		`Last error: ${lastError?.message || 'Unknown error'}`
	);
}

/**
 * Convert an ArrayBuffer to a Base64 string.
 *
 * @param buffer - The ArrayBuffer to convert.
 * @returns A Base64-encoded string representation of the buffer.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert a Base64 string to an ArrayBuffer.
 *
 * @param base64 - The Base64-encoded string to convert.
 * @returns An ArrayBuffer representation of the Base64 data.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Normalize a filename by removing path separators, trimming, limiting length,
 * and allowing common safe characters.
 *
 * @param name - The filename to normalize.
 * @returns A normalized filename safe for file operations.
 */
export function normalizeFilename(name: string): string {
	// Remove path separators, trim, limit length, and allow common safe chars
	const trimmed = name.trim().slice(0, 100);
	return trimmed.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/[\\/]+/g, '_');
}

// Utility type to drop either 'children' or 'child' prop from generic props
export type WithoutChildrenOrChild<T> = T extends { children?: unknown }
	? Omit<T, 'children'>
	: T extends { child?: unknown }
		? Omit<T, 'child'>
		: T;
