/**
 * Validation Service
 * Provides wrapper methods for domain validation
 */

import * as validation from '$lib/domain/validation';
import type { Project, ProjectDimensions } from '$lib/types/project';
import { createProjectId } from '$lib/types/ids';

export class ValidationService {
	validateProjectName(name: string) {
		const result = validation.validateProjectName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateLayerName(name: string) {
		const result = validation.validateLayerName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateTraitName(name: string) {
		const result = validation.validateTraitName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateDimensions(dimensions: ProjectDimensions) {
		const result = validation.validateDimensions(dimensions.width, dimensions.height);
		if (!result.success) throw new Error(result.error);
		return result.data as ProjectDimensions;
	}

	validateRarityWeight(weight: number) {
		const result = validation.validateRarityWeight(weight);
		if (!result.success) throw new Error(result.error);
		return result.data as number;
	}

	createDefaultProject(): Project {
		return {
			id: createProjectId(crypto.randomUUID()),
			name: 'My Collection',
			description: 'A collection of unique items',
			outputSize: { width: 0, height: 0 },
			layers: [],
			_needsProperLoad: true
		};
	}
}

export const validationService = new ValidationService();
