/**
 * Test suite for Zod-based validation module.
 *
 * @module validation.test
 */

import { describe, it, expect } from 'vitest';
import {
	sanitizeString,
	validateProjectName,
	validateLayerName,
	validateTraitName,
	validateDimensions,
	validateFilename,
	validateFileSize,
	validateFileType,
	validateRarityWeight,
	validateProject,
	validateLayer,
	validateTrait,
	validateImportedProject,
	createValidatedProject,
	createValidatedLayer,
	createValidatedTrait,
	safeValidate,
	ProjectSchema,
	LayerSchema,
	TraitSchema,
	ImportedProjectSchema
} from './validation';

describe('Zod Validation Module', () => {
	describe('sanitizeString', () => {
		it('removes leading and trailing whitespace', () => {
			expect(sanitizeString('  hello  ')).toBe('hello');
		});

		it('removes null bytes', () => {
			expect(sanitizeString('hello' + String.fromCharCode(0) + 'world')).toBe('helloworld');
		});

		it('removes control characters', () => {
			expect(sanitizeString(String.fromCharCode(1) + 'hello' + String.fromCharCode(127))).toBe(
				'hello'
			);
		});

		it('preserves valid characters', () => {
			expect(sanitizeString('hello world!')).toBe('hello world!');
		});

		it('handles empty string', () => {
			expect(sanitizeString('')).toBe('');
		});
	});

	describe('validateProjectName', () => {
		it('returns true for valid project name', () => {
			const result1 = validateProjectName('My Project');
			const result2 = validateProjectName('Project - Name (2023)');

			expect(result1.success).toBe(true);
			expect(result1.data).toBe('My Project');
			expect(result1.error).toBeUndefined();

			expect(result2.success).toBe(true);
			expect(result2.data).toBe('Project - Name (2023)');
			expect(result2.error).toBeUndefined();
		});

		it('returns false for invalid project name', () => {
			const result1 = validateProjectName('');
			const result2 = validateProjectName('a'.repeat(101));
			const result3 = validateProjectName('<script>alert(1)</script>');

			expect(result1.success).toBe(false);
			expect(result1.data).toBeUndefined();
			expect(result1.error).toBeDefined();

			expect(result2.success).toBe(false);
			expect(result2.data).toBeUndefined();
			expect(result2.error).toBeDefined();

			expect(result3.success).toBe(false);
			expect(result3.data).toBeUndefined();
			expect(result3.error).toBeDefined();
		});
	});

	describe('validateLayerName', () => {
		it('returns true for valid layer name', () => {
			const result1 = validateLayerName('Base Layer');
			const result2 = validateLayerName('Background Layer');

			expect(result1.success).toBe(true);
			expect(result1.data).toBe('Base Layer');
			expect(result1.error).toBeUndefined();

			expect(result2.success).toBe(true);
			expect(result2.data).toBe('Background Layer');
			expect(result2.error).toBeUndefined();
		});

		it('returns false for invalid layer name', () => {
			const result1 = validateLayerName('');
			const result2 = validateLayerName('a'.repeat(101));
			const result3 = validateLayerName('Invalid*');

			expect(result1.success).toBe(false);
			expect(result2.success).toBe(false);
			expect(result3.success).toBe(false);
		});
	});

	describe('validateTraitName', () => {
		it('returns true for valid trait name', () => {
			const result1 = validateTraitName('Red Hat');
			const result2 = validateTraitName('Blue Shirt');

			expect(result1.success).toBe(true);
			expect(result1.data).toBe('Red Hat');
			expect(result1.error).toBeUndefined();

			expect(result2.success).toBe(true);
			expect(result2.data).toBe('Blue Shirt');
			expect(result2.error).toBeUndefined();
		});

		it('returns false for invalid trait name', () => {
			const result1 = validateTraitName('');
			const result2 = validateTraitName('a'.repeat(101));
			const result3 = validateTraitName('Hat#');

			expect(result1.success).toBe(false);
			expect(result2.success).toBe(false);
			expect(result3.success).toBe(false);
		});
	});

	describe('validateDimensions', () => {
		it('returns true for valid dimensions', () => {
			const result1 = validateDimensions(1000, 1000);
			const result2 = validateDimensions(500, 500);

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
		});

		it('returns false for invalid dimensions', () => {
			const result1 = validateDimensions(0, 1000);
			const result2 = validateDimensions(-100, 1000);
			const result3 = validateDimensions(NaN, 1000);
			const result4 = validateDimensions(Infinity, 1000);

			expect(result1.success).toBe(false);
			expect(result2.success).toBe(false);
			expect(result3.success).toBe(false);
			expect(result4.success).toBe(false);
		});
	});

	describe('validateFilename', () => {
		it('returns true for valid filename', () => {
			expect(validateFilename('project.json').success).toBe(true);
			expect(validateFilename('my-file.txt').success).toBe(true);
		});

		it('returns false for invalid filename', () => {
			expect(validateFilename('').success).toBe(false);
			expect(validateFilename('a'.repeat(101)).success).toBe(false);
			expect(validateFilename('../secret').success).toBe(false);
			expect(validateFilename('file/name').success).toBe(false);
			expect(validateFilename('file\\name').success).toBe(false);
			expect(validateFilename('file*.txt').success).toBe(false);
		});
	});

	describe('validateFileSize', () => {
		it('returns true for valid file size', () => {
			expect(validateFileSize(1024 * 1024).success).toBe(true); // 1MB
			expect(validateFileSize(10 * 1024 * 1024).success).toBe(true); // 10MB
		});

		it('returns false for invalid file size', () => {
			expect(validateFileSize(0).success).toBe(false);
			expect(validateFileSize(-1).success).toBe(false);
			expect(validateFileSize(60 * 1024 * 1024).success).toBe(false); // 60MB > 50MB default
		});

		it('uses custom maxSize', () => {
			expect(validateFileSize(60 * 1024 * 1024, 70 * 1024 * 1024).success).toBe(true);
		});
	});

	describe('validateFileType', () => {
		it('returns true for allowed file type', () => {
			expect(validateFileType('image/png').success).toBe(true);
			expect(validateFileType('image/jpeg').success).toBe(true);
			expect(validateFileType('image/gif')).toBe(true);
		});

		it('returns false for disallowed file type', () => {
			expect(validateFileType('image/svg+xml').success).toBe(false);
			expect(validateFileType('application/pdf').success).toBe(false);
		});

		it('uses custom allowed types', () => {
			expect(validateFileType('image/svg+xml', ['image/svg+xml']).success).toBe(true);
		});
	});

	describe('validateRarityWeight', () => {
		it('returns true for valid rarity weight', () => {
			for (let w = 1; w <= 5; w++) {
				expect(validateRarityWeight(w).success).toBe(true);
			}
		});

		it('returns false for invalid rarity weight', () => {
			expect(validateRarityWeight(0).success).toBe(false);
			expect(validateRarityWeight(6).success).toBe(false);
			expect(validateRarityWeight(1.5).success).toBe(false);
		});
	});

	describe('validateProject', () => {
		it('returns true for valid project', () => {
			const validProject = {
				id: 'project-1',
				name: 'Test Project',
				description: 'A test project',
				outputSize: { width: 1000, height: 1000 },
				layers: []
			};
			expect(validateProject(validProject).success).toBe(true);
		});

		it('returns false for invalid project', () => {
			expect(validateProject(null).success).toBe(false);
			expect(validateProject({}).success).toBe(false);
			expect(validateProject({ id: '', name: '' }).success).toBe(false);
		});
	});

	describe('validateLayer', () => {
		it('returns true for valid layer', () => {
			const validLayer = {
				id: 'layer-1',
				name: 'Test Layer',
				order: 0,
				traits: []
			};
			expect(validateLayer(validLayer).success).toBe(true);
		});

		it('returns false for invalid layer', () => {
			expect(validateLayer(null).success).toBe(false);
			expect(validateLayer({}).success).toBe(false);
			expect(validateLayer({ id: '', name: '' }).success).toBe(false);
		});
	});

	describe('validateTrait', () => {
		it('returns true for valid trait', () => {
			const validTrait = {
				id: 'trait-1',
				name: 'Test Trait',
				imageUrl: 'blob:test',
				imageData: new ArrayBuffer(0),
				width: 100,
				height: 100,
				rarityWeight: 3
			};
			expect(validateTrait(validTrait).success).toBe(true);
		});

		it('returns false for invalid trait', () => {
			expect(validateTrait(null).success).toBe(false);
			expect(validateTrait({}).success).toBe(false);
			expect(validateTrait({ id: '', name: '' }).success).toBe(false);
		});
	});

	describe('validateImportedProject', () => {
		it('returns true for valid imported project', () => {
			const validProject = {
				id: 'project-1',
				name: 'Test Project',
				layers: [
					{
						id: 'layer-1',
						name: 'Layer 1',
						traits: [
							{
								id: 'trait-1',
								name: 'Trait 1'
							}
						]
					}
				]
			};
			expect(validateImportedProject(validProject).success).toBe(true);
		});

		it('returns false for invalid imported project', () => {
			expect(validateImportedProject(null).success).toBe(false);
			expect(validateImportedProject({}).success).toBe(false);
			expect(validateImportedProject({ id: '', name: '' }).success).toBe(false);
		});

		it('allows missing image data in imported traits', () => {
			const projectWithMissingImage = {
				id: 'project-1',
				name: 'Test',
				layers: [
					{
						id: 'layer-1',
						name: 'Layer',
						traits: [
							{
								id: 'trait-1',
								name: 'Trait'
								// no imageData
							}
						]
					}
				]
			};
			expect(validateImportedProject(projectWithMissingImage).success).toBe(true);
		});
	});

	describe('createValidatedProject', () => {
		it('creates a valid project with defaults', () => {
			const project = createValidatedProject();
			expect(validateProject(project)).toBe(true);
			expect(project.name).toBe('My NFT Collection');
			expect(project.description).toBe('A collection of unique NFTs');
			expect(project.outputSize).toEqual({ width: 1000, height: 1000 });
			expect(project.layers).toEqual([]);
		});

		it('applies overrides correctly', () => {
			const project = createValidatedProject({ name: 'Custom Project' });
			expect(project.name).toBe('Custom Project');
			expect(validateProject(project)).toBe(true);
		});

		it('throws for invalid overrides', () => {
			expect(() => createValidatedProject({ name: '' })).toThrow();
		});
	});

	describe('createValidatedLayer', () => {
		it('creates a valid layer with defaults', () => {
			const layer = createValidatedLayer();
			expect(validateLayer(layer)).toBe(true);
			expect(layer.name).toBe('New Layer');
			expect(layer.order).toBe(0);
			expect(layer.traits).toEqual([]);
		});

		it('applies overrides correctly', () => {
			const layer = createValidatedLayer({ name: 'Custom Layer', order: 1 });
			expect(layer.name).toBe('Custom Layer');
			expect(layer.order).toBe(1);
			expect(validateLayer(layer)).toBe(true);
		});

		it('throws for invalid overrides', () => {
			expect(() => createValidatedLayer({ name: '' })).toThrow();
		});
	});

	describe('createValidatedTrait', () => {
		it('creates a valid trait with defaults', () => {
			const trait = createValidatedTrait();
			expect(validateTrait(trait)).toBe(true);
			expect(trait.name).toBe('New Trait');
			expect(trait.rarityWeight).toBe(3);
			expect(trait.imageData).toBeInstanceOf(ArrayBuffer);
		});

		it('applies overrides correctly', () => {
			const trait = createValidatedTrait({ name: 'Custom Trait', rarityWeight: 5 });
			expect(trait.name).toBe('Custom Trait');
			expect(trait.rarityWeight).toBe(5);
			expect(validateTrait(trait)).toBe(true);
		});

		it('throws for invalid overrides', () => {
			expect(() => createValidatedTrait({ name: '' })).toThrow();
		});
	});

	describe('safeValidate', () => {
		it('returns success for valid data', () => {
			const result = safeValidate(ProjectSchema, {
				id: 'project-1',
				name: 'Test Project',
				outputSize: { width: 1000, height: 1000 },
				layers: []
			});
			expect(result.success).toBe(true);
			if (result.success && result.data) {
				expect(result.data.name).toBe('Test Project');
			}
		});

		it('returns errors for invalid data', () => {
			const result = safeValidate(ProjectSchema, {
				id: '',
				name: '',
				outputSize: { width: -1, height: -1 },
				layers: 'not an array'
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeDefined();
			}
		});
	});

	describe('Schema validation', () => {
		describe('ProjectSchema', () => {
			it('validates complete project structure', () => {
				const validProject = {
					id: 'project-1',
					name: 'Test Project',
					description: 'A test project',
					outputSize: { width: 1000, height: 1000 },
					layers: [],
					_needsProperLoad: true
				};
				expect(ProjectSchema.safeParse(validProject).success).toBe(true);
			});

			it('rejects invalid project structure', () => {
				const invalidProject = {
					id: '',
					name: '',
					outputSize: { width: -1, height: -1 },
					layers: 'not an array'
				};
				expect(ProjectSchema.safeParse(invalidProject).success).toBe(false);
			});
		});

		describe('LayerSchema', () => {
			it('validates complete layer structure', () => {
				const validLayer = {
					id: 'layer-1',
					name: 'Test Layer',
					order: 0,
					isOptional: true,
					traits: []
				};
				expect(LayerSchema.safeParse(validLayer).success).toBe(true);
			});

			it('rejects invalid layer structure', () => {
				const invalidLayer = {
					id: '',
					name: '',
					order: -1,
					traits: 'not an array'
				};
				expect(LayerSchema.safeParse(invalidLayer).success).toBe(false);
			});
		});

		describe('TraitSchema', () => {
			it('validates complete trait structure', () => {
				const validTrait = {
					id: 'trait-1',
					name: 'Test Trait',
					imageUrl: 'blob:test',
					imageData: new ArrayBuffer(0),
					width: 100,
					height: 100,
					rarityWeight: 3
				};
				expect(TraitSchema.safeParse(validTrait).success).toBe(true);
			});

			it('rejects invalid trait structure', () => {
				const invalidTrait = {
					id: '',
					name: '',
					imageUrl: 'not-a-url',
					imageData: 'not-arraybuffer',
					width: -1,
					height: -1,
					rarityWeight: 0
				};
				expect(TraitSchema.safeParse(invalidTrait).success).toBe(false);
			});
		});

		describe('ImportedProjectSchema', () => {
			it('validates imported project with missing image data', () => {
				const importedProject = {
					id: 'project-1',
					name: 'Test Project',
					layers: [
						{
							id: 'layer-1',
							name: 'Layer 1',
							traits: [
								{
									id: 'trait-1',
									name: 'Trait 1'
									// missing imageData is allowed for imports
								}
							]
						}
					]
				};
				expect(ImportedProjectSchema.safeParse(importedProject).success).toBe(true);
			});
		});
	});
});
