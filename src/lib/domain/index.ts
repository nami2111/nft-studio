// src/lib/domain/index.ts

export * from './models';
export * from './project.domain';
export {
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateDimensions,
	createDefaultProject
} from './project.service';
export * from './worker.service';
