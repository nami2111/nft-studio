/**
 * Validation utilities for the NFT Studio.
 *
 * @module validation
 */

/**
 * Validates a project name.
 *
 * @param name - The project name to validate.
 * @returns True if the project name is valid, false otherwise.
 */
export function isValidProjectName(name: unknown): boolean {
	return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
}

/**
 * Validates a layer name.
 *
 * @param name - The layer name to validate.
 * @returns True if the layer name is valid, false otherwise.
 */
export function isValidLayerName(name: unknown): boolean {
	return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
}

/**
 * Validates a trait name.
 *
 * @param name - The trait name to validate.
 * @returns True if the trait name is valid, false otherwise.
 */
export function isValidTraitName(name: unknown): boolean {
	return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
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

	if (typeof projectData.id !== 'string' || typeof projectData.name !== 'string') return false;
	if (!Array.isArray(projectData.layers)) return false;

	for (const layer of projectData.layers as unknown[]) {
		if (!layer || typeof layer !== 'object') return false;
		const layerObj = layer as Record<string, unknown>;

		if (typeof layerObj.id !== 'string' || typeof layerObj.name !== 'string') return false;
		if (layerObj.order !== undefined && typeof layerObj.order !== 'number') return false;
		if (!Array.isArray(layerObj.traits)) return false;

		for (const trait of layerObj.traits as unknown[]) {
			if (!trait || typeof trait !== 'object') return false;
			const traitObj = trait as Record<string, unknown>;

			if (typeof traitObj.id !== 'string' || typeof traitObj.name !== 'string') return false;
			// imageData may be missing (export strips image data)
		}
	}

	// outputSize may be present; if present ensure width/height are numbers
	if (projectData.outputSize) {
		const outputSize = projectData.outputSize as Record<string, unknown>;
		if (typeof outputSize.width !== 'number' || typeof outputSize.height !== 'number') return false;
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

	return (
		typeof layerData.id === 'string' &&
		typeof layerData.name === 'string' &&
		(layerData.order === undefined || typeof layerData.order === 'number')
	);
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

	return (
		typeof traitData.id === 'string' &&
		typeof traitData.name === 'string' &&
		(traitData.rarityWeight === undefined || typeof traitData.rarityWeight === 'number')
	);
}

/**
 * Validates project dimensions.
 *
 * @param width - The width to validate.
 * @param height - The height to validate.
 * @returns True if the dimensions are valid, false otherwise.
 */
export function isValidDimensions(width: unknown, height: unknown): boolean {
	return (
		typeof width === 'number' &&
		typeof height === 'number' &&
		width > 0 &&
		height > 0 &&
		Number.isFinite(width) &&
		Number.isFinite(height)
	);
}

/**
 * Validates a filename string.
 *
 * @param filename - The filename to validate.
 * @returns True if the filename is valid, false otherwise.
 */
export function isValidFilename(filename: unknown): boolean {
	return typeof filename === 'string' && filename.trim().length > 0 && filename.length <= 100;
}
