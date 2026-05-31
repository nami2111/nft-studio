/**
 * Validation Service
 *
 * Wraps domain validators. Two surfaces:
 *   - Single-field validators throw on first error (used by stores during user input)
 *   - {@link validateProjectUpdate} composes multiple field checks and returns
 *     aggregated errors so forms can highlight every problem at once
 */

import * as validation from '$lib/domain/validation';
import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import type { Project, ProjectDimensions } from '$lib/types/project';
import { createProjectId } from '$lib/types/ids';

export interface FieldError {
	field: string;
	message: string;
}

export interface ValidationOutcome {
	valid: boolean;
	errors: FieldError[];
}

export interface ProjectUpdateInput {
	name?: string;
	description?: string;
	dimensions?: ProjectDimensions;
	symbol?: string;
	sellerFeeBasisPoints?: number;
	externalUrl?: string;
	animationUrl?: string;
	metadataStandard?: MetadataStandard;
}

export class ValidationService {
	validateProjectName(name: string): string {
		const result = validation.validateProjectName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateLayerName(name: string): string {
		const result = validation.validateLayerName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateTraitName(name: string): string {
		const result = validation.validateTraitName(name);
		if (!result.success) throw new Error(result.error);
		return result.data as string;
	}

	validateDimensions(dimensions: ProjectDimensions): ProjectDimensions {
		const result = validation.validateDimensions(dimensions.width, dimensions.height);
		if (!result.success) throw new Error(result.error);
		return result.data as ProjectDimensions;
	}

	validateRarityWeight(weight: number): number {
		const result = validation.validateRarityWeight(weight);
		if (!result.success) throw new Error(result.error);
		return result.data as number;
	}

	/**
	 * Compose multiple field validations and return all errors at once.
	 * Use this for form submission where every problem should be surfaced
	 * to the user, rather than rejecting on the first error.
	 */
	validateProjectUpdate(updates: ProjectUpdateInput): ValidationOutcome {
		const errors: FieldError[] = [];

		if (updates.name !== undefined) {
			const r = validation.validateProjectName(updates.name);
			if (!r.success) errors.push({ field: 'name', message: r.error ?? 'Invalid project name' });
		}

		if (updates.dimensions !== undefined) {
			const r = validation.validateDimensions(updates.dimensions.width, updates.dimensions.height);
			if (!r.success)
				errors.push({ field: 'dimensions', message: r.error ?? 'Invalid dimensions' });
		}

		if (updates.sellerFeeBasisPoints !== undefined) {
			const fee = updates.sellerFeeBasisPoints;
			if (!Number.isFinite(fee) || fee < 0 || fee > 10000) {
				errors.push({
					field: 'sellerFeeBasisPoints',
					message: 'Seller fee must be between 0 and 10000 basis points'
				});
			}
		}

		if (updates.externalUrl !== undefined && updates.externalUrl.length > 0) {
			if (!isValidUrl(updates.externalUrl)) {
				errors.push({ field: 'externalUrl', message: 'External URL must be a valid URL' });
			}
		}

		if (updates.animationUrl !== undefined && updates.animationUrl.length > 0) {
			if (!isValidUrl(updates.animationUrl)) {
				errors.push({ field: 'animationUrl', message: 'Animation URL must be a valid URL' });
			}
		}

		return { valid: errors.length === 0, errors };
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

function isValidUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

export const validationService = new ValidationService();
