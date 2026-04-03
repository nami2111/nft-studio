import {
	createValidatedProject,
	validateProject,
	createValidatedTrait,
	validateTrait
} from './src/lib/domain/validation';

try {
	console.log('--- Testing Project Defaults ---');
	const project = createValidatedProject();
	const result = validateProject(project);
	console.log('Project Default Result:', result);
	if (!result.success) {
		console.error('Validation Error:', result.error);
	}
} catch (e) {
	console.error('Create Project Error:', e);
}

try {
	console.log('--- Testing Trait Defaults ---');
	const trait = createValidatedTrait();
	const result2 = validateTrait(trait);
	console.log('Trait Default Result:', result2);
	if (!result2.success) {
		console.error('Validation Error:', result2.error);
	}
} catch (e) {
	console.error('Create Trait Error:', e);
}
