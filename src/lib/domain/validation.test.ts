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
			expect(validateProjectName('My Project')).toBe(true);
			expect(validateProjectName('Project - Name (2023)')).toBe(true);
		});

		it('returns false for invalid project name', () => {
			expect(validateProjectName('')).toBe(false);
			expect(validateProjectName('a'.repeat(101))).toBe(false);
			expect(validateProjectName('<script>alert(1)</script>')).toBe(false);
		});
	});

	describe('validateLayerName', () => {
		it('returns true for valid layer name', () => {
			expect(validateLayerName('Base Layer')).toBe(true);
			expect(validateLayerName('Background Layer')).toBe(true);
		});

		it('returns false for invalid layer name', () => {
			expect(validateLayerName('')).toBe(false);
			expect(validateLayerName('a'.repeat(101))).toBe(false);
			expect(validateLayerName('Invalid*')).toBe(false);
		});
	});

	describe('validateTraitName', () => {
		it('returns true for valid trait name', () => {
			expect(validateTraitName('Red Hat')).toBe(true);
			expect(validateTraitName('Blue Shirt')).toBe(true);
		});

		it('returns false for invalid trait name', () => {
			expect(validateTraitName('')).toBe(false);
			expect(validateTraitName('a'.repeat(101))).toBe(false);
			expect(validateTraitName('Hat#')).toBe(false);
		});
	});

	describe('validateDimensions', () => {
		it('returns true for valid dimensions', () => {
			expect(validateDimensions(1000, 1000)).toBe(true);
			expect(validateDimensions(500, 500)).toBe(true);
		});

		it('returns false for invalid dimensions', () => {
			expect(validateDimensions(0, 1000)).toBe(false);
			expect(validateDimensions(-100, 1000)).toBe(false);
			expect(validateDimensions(NaN, 1000)).toBe(false);
			expect(validateDimensions(Infinity, 1000)).toBe(false);
		});
	});

	describe('validateFilename', () => {
		it('returns true for valid filename', () => {
			expect(validateFilename('project.json')).toBe(true);
			expect(validateFilename('my-file.txt')).toBe(true);
		});

		it('returns false for invalid filename', () => {
			expect(validateFilename('')).toBe(false);
			expect(validateFilename('a'.repeat(101))).toBe(false);
			expect(validateFilename('../secret')).toBe(false);
			expect(validateFilename('file/name')).toBe(false);
			expect(validateFilename('file\\name')).toBe(false);
			expect(validateFilename('file*.txt')).toBe(false);
		});
	});

	describe('validateFileSize', () => {
		it('returns true for valid file size', () => {
			expect(validateFileSize(1024 * 1024)).toBe(true); // 1MB
			expect(validateFileSize(10 * 1024 * 1024)).toBe(true); // 10MB
		});

		it('returns false for invalid file size', () => {
			expect(validateFileSize(0)).toBe(false);
			expect(validateFileSize(-1)).toBe(false);
			expect(validateFileSize(60 * 1024 * 1024)).toBe(false); // 60MB > 50MB default
		});

		it('uses custom maxSize', () => {
			expect(validateFileSize(60 * 1024 * 1024, 70 * 1024 * 1024)).toBe(true);
		});
	});

	describe('validateFileType', () => {
		it('returns true for allowed file type', () => {
			expect(validateFileType('image/png')).toBe(true);
			expect(validateFileType('image/jpeg')).toBe(true);
			expect(validateFileType('image/gif')).toBe(true);
		});

		it('returns false for disallowed file type', () => {
			expect(validateFileType('image/svg+xml')).toBe(false);
			expect(validateFileType('application/pdf')).toBe(false);
		});

		it('uses custom allowed types', () => {
			expect(validateFileType('image/svg+xml', ['image/svg+xml'])).toBe(true);
		});
	});

	describe('validateRarityWeight', () => {
		it('returns true for valid rarity weight', () => {
			for (let w = 1; w <= 5; w++) {
				expect(validateRarityWeight(w)).toBe(true);
			}
		});

		it('returns false for invalid rarity weight', () => {
			expect(validateRarityWeight(0)).toBe(false);
			expect(validateRarityWeight(6)).toBe(false);
			expect(validateRarityWeight(1.5)).toBe(false);
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
			expect(validateProject(validProject)).toBe(true);
		});

		it('returns false for invalid project', () => {
			expect(validateProject(null)).toBe(false);
			expect(validateProject({})).toBe(false);
			expect(validateProject({ id: '', name: '' })).toBe(false);
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
			expect(validateLayer(validLayer)).toBe(true);
		});

		it('returns false for invalid layer', () => {
			expect(validateLayer(null)).toBe(false);
			expect(validateLayer({})).toBe(false);
			expect(validateLayer({ id: '', name: '' })).toBe(false);
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
			expect(validateTrait(validTrait)).toBe(true);
		});

		it('returns false for invalid trait', () => {
			expect(validateTrait(null)).toBe(false);
			expect(validateTrait({})).toBe(false);
			expect(validateTrait({ id: '', name: '' })).toBe(false);
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
			expect(validateImportedProject(validProject)).toBe(true);
		});

		it('returns false for invalid imported project', () => {
			expect(validateImportedProject(null)).toBe(false);
			expect(validateImportedProject({})).toBe(false);
			expect(validateImportedProject({ id: '', name: '' })).toBe(false);
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
			expect(validateImportedProject(projectWithMissingImage)).toBe(true);
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
