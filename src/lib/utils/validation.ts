/**
 * Validation utilities for the NFT Studio.
 *
 * @module validation
 */

/**
 * Sanitizes a string by trimming whitespace and removing potentially dangerous characters.
 *
 * @param input - The string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string): string {
	// Remove NULL bytes and control characters except tab, newline, and carriage return
	const controlChars = [
		'\u0000',
		'\u0001',
		'\u0002',
		'\u0003',
		'\u0004',
		'\u0005',
		'\u0006',
		'\u0007',
		'\u0008',
		'\u000B',
		'\u000C',
		'\u000E',
		'\u000F',
		'\u0010',
		'\u0011',
		'\u0012',
		'\u0013',
		'\u0014',
		'\u0015',
		'\u0016',
		'\u0017',
		'\u0018',
		'\u0019',
		'\u001A',
		'\u001B',
		'\u001C',
		'\u001D',
		'\u001E',
		'\u001F',
		'\u007F'
	];

	let result = input.replace(/\0/g, ''); // Remove NULL bytes

	// Remove control characters
	for (const char of controlChars) {
		result = result.replace(new RegExp(char, 'g'), '');
	}

	return result.trim();
}

/**
 * Validates and sanitizes a project name.
 *
 * @param name - The project name to validate.
 * @returns The sanitized project name if valid, null otherwise.
 */
export function isValidProjectName(name: unknown): string | null {
	if (typeof name !== 'string') return null;

	const sanitized = sanitizeString(name);

	// Check length constraints
	if (sanitized.length === 0 || sanitized.length > 100) return null;

	// Check for valid characters (allow letters, numbers, spaces, hyphens, underscores, and common punctuation)
	if (!/^[\w\s\-.,'()&!]+$/.test(sanitized)) return null;

	return sanitized;
}

/**
 * Validates and sanitizes a layer name.
 *
 * @param name - The layer name to validate.
 * @returns The sanitized layer name if valid, null otherwise.
 */
export function isValidLayerName(name: unknown): string | null {
	if (typeof name !== 'string') return null;

	const sanitized = sanitizeString(name);

	// Check length constraints
	if (sanitized.length === 0 || sanitized.length > 100) return null;

	// Check for valid characters (allow letters, numbers, spaces, hyphens, underscores, and common punctuation)
	if (!/^[\w\s\-.,'()&!]+$/.test(sanitized)) return null;

	return sanitized;
}

/**
 * Validates and sanitizes a trait name.
 *
 * @param name - The trait name to validate.
 * @returns The sanitized trait name if valid, null otherwise.
 */
export function isValidTraitName(name: unknown): string | null {
	if (typeof name !== 'string') return null;

	const sanitized = sanitizeString(name);

	// Check length constraints
	if (sanitized.length === 0 || sanitized.length > 100) return null;

	// Check for valid characters (allow letters, numbers, spaces, hyphens, underscores, and common punctuation)
	if (!/^[\w\s\-.,'()&!]+$/.test(sanitized)) return null;

	return sanitized;
}

/**
 * Validates the shape of a project object imported from JSON.
 * Accepts well-formed projects or projects that have missing image data (as images are stripped during export).
 *
 * @param data - The data to validate.
 * @returns True if the data is valid, false otherwise.
 */
export function isValidImportedProject(data: unknown): data is Record<string, unknown> {
	if (!data || typeof data !== 'object') return false;

	const projectData = data as Record<string, unknown>;

	// Validate required fields
	if (typeof projectData.id !== 'string' || !projectData.id.trim()) return false;
	if (typeof projectData.name !== 'string' || !isValidProjectName(projectData.name)) return false;
	if (!Array.isArray(projectData.layers)) return false;

	// Validate layers
	for (const layer of projectData.layers as unknown[]) {
		if (!layer || typeof layer !== 'object') return false;
		const layerObj = layer as Record<string, unknown>;

		// Validate layer required fields
		if (typeof layerObj.id !== 'string' || !layerObj.id.trim()) return false;
		if (typeof layerObj.name !== 'string' || !isValidLayerName(layerObj.name)) return false;

		// Validate layer order (if present)
		if (layerObj.order !== undefined && typeof layerObj.order !== 'number') return false;

		// Validate traits array
		if (!Array.isArray(layerObj.traits)) return false;

		// Validate traits
		for (const trait of layerObj.traits as unknown[]) {
			if (!trait || typeof trait !== 'object') return false;
			const traitObj = trait as Record<string, unknown>;

			// Validate trait required fields
			if (typeof traitObj.id !== 'string' || !traitObj.id.trim()) return false;
			if (typeof traitObj.name !== 'string' || !isValidTraitName(traitObj.name)) return false;

			// Validate rarity weight (if present)
			if (traitObj.rarityWeight !== undefined && !isValidRarityWeight(traitObj.rarityWeight))
				return false;

			// imageData may be missing (export strips image data)
		}
	}

	// Validate outputSize (if present)
	if (projectData.outputSize) {
		const outputSize = projectData.outputSize as Record<string, unknown>;
		if (typeof outputSize.width !== 'number' || typeof outputSize.height !== 'number') return false;

		// Validate dimensions are positive and finite
		if (
			outputSize.width <= 0 ||
			outputSize.height <= 0 ||
			!Number.isFinite(outputSize.width) ||
			!Number.isFinite(outputSize.height)
		)
			return false;
	}

	return true;
}

/**
 * Validates that a layer has valid properties.
 *
 * @param layer - The layer to validate.
 * @returns True if the layer is valid, false otherwise.
 */
export function isValidLayer(layer: unknown): boolean {
	if (!layer || typeof layer !== 'object') return false;

	const layerData = layer as { id?: string; name?: string; order?: number };

	// Validate required fields
	if (typeof layerData.id !== 'string' || !layerData.id.trim()) return false;
	if (typeof layerData.name !== 'string' || !isValidLayerName(layerData.name)) return false;

	// Validate order (if present)
	if (layerData.order !== undefined && typeof layerData.order !== 'number') return false;

	return true;
}

/**
 * Validates that a trait has valid properties.
 *
 * @param trait - The trait to validate.
 * @returns True if the trait is valid, false otherwise.
 */
export function isValidTrait(trait: unknown): boolean {
	if (!trait || typeof trait !== 'object') return false;

	const traitData = trait as { id?: string; name?: string; rarityWeight?: number };

	// Validate required fields
	if (typeof traitData.id !== 'string' || !traitData.id.trim()) return false;
	if (typeof traitData.name !== 'string' || !isValidTraitName(traitData.name)) return false;

	// Validate rarity weight (if present)
	if (traitData.rarityWeight !== undefined && !isValidRarityWeight(traitData.rarityWeight))
		return false;

	return true;
}

/**
 * Validates project dimensions.
 *
 * @param width - The width to validate.
 * @param height - The height to validate.
 * @returns True if the dimensions are valid, false otherwise.
 */
export function isValidDimensions(width: unknown, height: unknown): boolean {
	// Validate types
	if (typeof width !== 'number' || typeof height !== 'number') return false;

	// Validate values are positive and finite
	if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height))
		return false;

	return true;
}

/**
 * Validates a filename string.
 *
 * @param filename - The filename to validate.
 * @returns The sanitized filename if valid, null otherwise.
 */
export function isValidFilename(filename: unknown): string | null {
	if (typeof filename !== 'string') return null;

	const sanitized = sanitizeString(filename);

	// Check length constraints
	if (sanitized.length === 0 || sanitized.length > 100) return null;

	// Check for valid characters and disallow path traversal sequences
	if (
		!/^[\w\s\-.,'()&!]+$/.test(sanitized) ||
		sanitized.includes('..') ||
		sanitized.includes('/') ||
		sanitized.includes('\\')
	)
		return null;

	return sanitized;
}

/**
 * Validates and sanitizes a file size.
 *
 * @param size - The file size to validate.
 * @param maxSize - The maximum allowed file size in bytes.
 * @returns True if the file size is valid, false otherwise.
 */
export function isValidFileSize(size: unknown, maxSize: number = 50 * 1024 * 1024): boolean {
	// 50MB default
	if (typeof size !== 'number') return false;

	// Validate size is positive and within limits
	if (size <= 0 || size > maxSize || !Number.isFinite(size)) return false;

	return true;
}

/**
 * Validates a file type.
 *
 * @param mimeType - The MIME type to validate.
 * @param allowedTypes - Array of allowed MIME types.
 * @returns True if the file type is valid, false otherwise.
 */
export function isValidFileType(
	mimeType: string,
	allowedTypes: string[] = ['image/png', 'image/jpeg', 'image/gif']
): boolean {
	return allowedTypes.includes(mimeType);
}

/**
 * Validates a rarity weight value.
 *
 * @param weight - The rarity weight to validate.
 * @returns True if the rarity weight is valid, false otherwise.
 */
export function isValidRarityWeight(weight: unknown): boolean {
	if (typeof weight !== 'number') return false;

	// Validate weight is a positive integer between 1 and 5
	if (weight < 1 || weight > 5 || !Number.isInteger(weight)) return false;

	return true;
}
