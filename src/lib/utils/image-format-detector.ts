/**
 * Utility functions for detecting image formats from binary data
 */

/**
 * Detects the image format from an ArrayBuffer
 * @param buffer - The image data as ArrayBuffer
 * @returns The detected image format (png, jpg, jpeg, gif, webp, etc.) or 'unknown'
 */
export function detectImageFormat(buffer: ArrayBuffer): string {
	const view = new Uint8Array(buffer);

	// Check for JPEG (FF D8 FF)
	if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
		return 'jpg';
	}

	// Check for PNG (89 50 4E 47)
	if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
		return 'png';
	}

	// Check for GIF (GIF87a or GIF89a)
	if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46) {
		return 'gif';
	}

	// Check for WebP (RIFF....WEBP)
	if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
		// Check for WEBP signature at offset 8
		if (view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) {
			return 'webp';
		}
	}

	// Check for BMP (BM)
	if (view[0] === 0x42 && view[1] === 0x4d) {
		return 'bmp';
	}

	// Check for TIFF (II* or MM*)
	if ((view[0] === 0x49 && view[1] === 0x49 && view[2] === 0x2a) ||
	    (view[0] === 0x4d && view[1] === 0x4d && view[2] === 0x2a)) {
		return 'tiff';
	}

	// Check for ICO (00 00 01 00)
	if (view[0] === 0x00 && view[1] === 0x00 && view[2] === 0x01 && view[3] === 0x00) {
		return 'ico';
	}

	return 'unknown';
}

/**
 * Gets the MIME type for a given image format
 * @param format - The image format
 * @returns The corresponding MIME type
 */
export function getMimeType(format: string): string {
	const formatMap: Record<string, string> = {
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'webp': 'image/webp',
		'bmp': 'image/bmp',
		'tiff': 'image/tiff',
		'tif': 'image/tiff',
		'ico': 'image/x-icon',
		'svg': 'image/svg+xml'
	};

	return formatMap[format.toLowerCase()] || 'image/png';
}

/**
 * Gets the file extension for a given image format
 * @param format - The image format
 * @returns The corresponding file extension with dot
 */
export function getFileExtension(format: string): string {
	return format && format !== 'unknown' ? `.${format}` : '.png';
}