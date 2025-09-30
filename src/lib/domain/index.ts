// src/lib/domain/index.ts

export * from './models';
export * from './project.domain';
export {
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateDimensions,
	validateRarityWeight,
	validateImportedProject,
	sanitizeString,
	createValidatedProject,
	createValidatedLayer,
	createValidatedTrait,
	safeValidate
} from './validation';

export * from './worker.service';
