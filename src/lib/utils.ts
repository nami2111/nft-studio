/**
 * Utility functions and type helpers for the NFT Studio.
 *
 * @module utils
 */

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
 * Convert a File object to an ArrayBuffer.
 *
 * @param file - The File object to convert.
 * @returns A promise that resolves with the ArrayBuffer representation of the file.
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	try {
		return await file.arrayBuffer();
	} catch (error) {
		throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
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
export type WithoutChildrenOrChild<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T extends { child?: unknown } ? Omit<T, 'child'> : T;
