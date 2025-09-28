import { describe, it, expect } from 'vitest';

import {
	sanitizeString,
	isValidProjectName,
	isValidLayerName,
	isValidTraitName,
	isValidImportedProject,
	isValidLayer,
	isValidTrait,
	isValidDimensions,
	isValidFilename,
	isValidFileSize,
	isValidFileType,
	isValidRarityWeight
} from './validation';

describe('Validation Utilities', () => {
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

	describe('isValidProjectName', () => {
		it('returns null for non-string input', () => {
			expect(isValidProjectName(123)).toBeNull();
			expect(isValidProjectName(null)).toBeNull();
			expect(isValidProjectName(undefined)).toBeNull();
		});

		it('returns sanitized name for valid input', () => {
			expect(isValidProjectName(' My Project ')).toBe('My Project');
		});

		it('returns null for empty string', () => {
			expect(isValidProjectName('')).toBeNull();
		});

		it('returns null for too long string', () => {
			expect(isValidProjectName('a'.repeat(101))).toBeNull();
		});

		it('returns null for invalid characters', () => {
			expect(isValidProjectName('<script>alert(1)</script>')).toBeNull();
		});

		it('allows valid punctuation', () => {
			expect(isValidProjectName('Project - Name (2023).')).toBe('Project - Name (2023).');
		});
	});

	describe('isValidLayerName', () => {
		it('returns null for non-string input', () => {
			expect(isValidLayerName(123)).toBeNull();
		});

		it('returns sanitized name for valid input', () => {
			expect(isValidLayerName(' Base Layer ')).toBe('Base Layer');
		});

		it('returns null for empty or too long', () => {
			expect(isValidLayerName('')).toBeNull();
			expect(isValidLayerName('a'.repeat(101))).toBeNull();
		});

		it('returns null for invalid characters', () => {
			expect(isValidLayerName('Invalid*')).toBeNull();
		});
	});

	describe('isValidTraitName', () => {
		it('returns null for non-string input', () => {
			expect(isValidTraitName(123)).toBeNull();
		});

		it('returns sanitized name for valid input', () => {
			expect(isValidTraitName(' Red Hat ')).toBe('Red Hat');
		});

		it('returns null for empty or too long', () => {
			expect(isValidTraitName('')).toBeNull();
			expect(isValidTraitName('a'.repeat(101))).toBeNull();
		});

		it('returns null for invalid characters', () => {
			expect(isValidTraitName('Hat#')).toBeNull();
		});
	});

	describe('isValidImportedProject', () => {
		it('returns false for non-object input', () => {
			expect(isValidImportedProject(null)).toBeFalsy();
			expect(isValidImportedProject('string')).toBeFalsy();
		});

		it('returns true for minimal valid project', () => {
			const validProject = {
				id: 'proj1',
				name: 'Test Project',
				layers: [
					{
						id: 'layer1',
						name: 'Layer 1',
						traits: [
							{
								id: 'trait1',
								name: 'Trait 1'
							}
						]
					}
				]
			};
			expect(isValidImportedProject(validProject)).toBeTruthy();
		});

		it('allows empty layers', () => {
			const emptyLayers = {
				id: 'proj1',
				name: 'Test',
				layers: []
			};
			expect(isValidImportedProject(emptyLayers)).toBeTruthy();
		});

		it('returns false for missing id', () => {
			const invalidProject = {
				name: 'Test Project',
				layers: []
			};
			expect(isValidImportedProject(invalidProject)).toBeFalsy();
		});

		it('returns false for invalid name', () => {
			const invalidProject = {
				id: 'proj1',
				name: '<invalid>',
				layers: []
			};
			expect(isValidImportedProject(invalidProject)).toBeFalsy();
		});

		it('returns false for non-array layers', () => {
			const invalidProject = {
				id: 'proj1',
				name: 'Test',
				layers: 'not array'
			};
			expect(isValidImportedProject(invalidProject)).toBeFalsy();
		});

		it('returns false for invalid layer', () => {
			const invalidProject = {
				id: 'proj1',
				name: 'Test',
				layers: [
					{
						name: 'Layer'
						// missing id
					}
				]
			};
			expect(isValidImportedProject(invalidProject)).toBeFalsy();
		});

		it('allows missing imageData in traits', () => {
			const validProjectWithMissingImage = {
				id: 'proj1',
				name: 'Test',
				layers: [
					{
						id: 'layer1',
						name: 'Layer',
						traits: [
							{
								id: 'trait1',
								name: 'Trait'
								// no imageData
							}
						]
					}
				]
			};
			expect(isValidImportedProject(validProjectWithMissingImage)).toBeTruthy();
		});

		it('validates outputSize dimensions', () => {
			const validWithSize = {
				id: 'proj1',
				name: 'Test',
				layers: [],
				outputSize: {
					width: 1000,
					height: 1000
				}
			};
			expect(isValidImportedProject(validWithSize)).toBeTruthy();

			const invalidSize = {
				id: 'proj1',
				name: 'Test',
				layers: [],
				outputSize: {
					width: -1,
					height: 1000
				}
			};
			expect(isValidImportedProject(invalidSize)).toBeFalsy();
		});
	});

	describe('isValidLayer', () => {
		it('returns false for non-object', () => {
			expect(isValidLayer(null)).toBeFalsy();
		});

		it('returns true for valid layer', () => {
			const validLayer = {
				id: 'layer1',
				name: 'Layer 1',
				order: 0,
				traits: []
			};
			expect(isValidLayer(validLayer)).toBeTruthy();
		});

		it('returns false for missing id', () => {
			const invalidLayer = {
				name: 'Layer 1'
			};
			expect(isValidLayer(invalidLayer)).toBeFalsy();
		});

		it('returns false for invalid name', () => {
			const invalidLayer = {
				id: 'layer1',
				name: '<invalid>'
			};
			expect(isValidLayer(invalidLayer)).toBeFalsy();
		});

		it('allows missing order and traits', () => {
			const minimalLayer = {
				id: 'layer1',
				name: 'Layer 1'
			};
			expect(isValidLayer(minimalLayer)).toBeTruthy();
		});
	});

	describe('isValidTrait', () => {
		it('returns false for non-object', () => {
			expect(isValidTrait(null)).toBeFalsy();
		});

		it('returns true for valid trait', () => {
			const validTrait = {
				id: 'trait1',
				name: 'Trait 1',
				rarityWeight: 1
			};
			expect(isValidTrait(validTrait)).toBeTruthy();
		});

		it('returns false for missing id', () => {
			const invalidTrait = {
				name: 'Trait 1'
			};
			expect(isValidTrait(invalidTrait)).toBeFalsy();
		});

		it('returns false for invalid rarityWeight', () => {
			const invalidTrait = {
				id: 'trait1',
				name: 'Trait 1',
				rarityWeight: 6.5
			};
			expect(isValidTrait(invalidTrait)).toBeFalsy();
		});

		it('allows missing rarityWeight', () => {
			const minimalTrait = {
				id: 'trait1',
				name: 'Trait 1'
			};
			expect(isValidTrait(minimalTrait)).toBeTruthy();
		});
	});

	describe('isValidDimensions', () => {
		it('returns false for non-numbers', () => {
			expect(isValidDimensions('1000', 1000)).toBeFalsy();
			expect(isValidDimensions(1000, null)).toBeFalsy();
		});

		it('returns true for valid positive finite dimensions', () => {
			expect(isValidDimensions(1000, 1000)).toBeTruthy();
		});

		it('returns false for zero or negative', () => {
			expect(isValidDimensions(0, 1000)).toBeFalsy();
			expect(isValidDimensions(-100, 1000)).toBeFalsy();
		});

		it('returns false for non-finite', () => {
			expect(isValidDimensions(NaN, 1000)).toBeFalsy();
			expect(isValidDimensions(Infinity, 1000)).toBeFalsy();
		});
	});

	describe('isValidFilename', () => {
		it('returns null for non-string', () => {
			expect(isValidFilename(123)).toBeNull();
		});

		it('returns sanitized filename for valid input', () => {
			expect(isValidFilename(' project.json ')).toBe('project.json');
		});

		it('returns null for path traversal', () => {
			expect(isValidFilename('../secret')).toBeNull();
		});

		it('returns null for slashes', () => {
			expect(isValidFilename('file/name')).toBeNull();
			expect(isValidFilename('file\\name')).toBeNull();
		});

		it('returns null for invalid characters', () => {
			expect(isValidFilename('file*.txt')).toBeNull();
		});
	});

	describe('isValidFileSize', () => {
		it('returns false for non-number', () => {
			expect(isValidFileSize('10MB')).toBeFalsy();
		});

		it('returns true for valid size under default limit', () => {
			expect(isValidFileSize(1024 * 1024)).toBeTruthy(); // 1MB
		});

		it('returns false for size over limit', () => {
			expect(isValidFileSize(60 * 1024 * 1024)).toBeFalsy(); // 60MB > 50MB
		});

		it('uses custom maxSize', () => {
			expect(isValidFileSize(60 * 1024 * 1024, 70 * 1024 * 1024)).toBeTruthy();
		});

		it('returns false for zero or negative', () => {
			expect(isValidFileSize(0)).toBeFalsy();
			expect(isValidFileSize(-1)).toBeFalsy();
		});
	});

	describe('isValidFileType', () => {
		it('returns true for allowed type', () => {
			expect(isValidFileType('image/png')).toBeTruthy();
		});

		it('returns false for disallowed type', () => {
			expect(isValidFileType('image/svg+xml')).toBeFalsy();
		});

		it('uses custom allowed types', () => {
			expect(isValidFileType('image/svg+xml', ['image/svg+xml'])).toBeTruthy();
		});
	});

	describe('isValidRarityWeight', () => {
		it('returns false for non-number', () => {
			expect(isValidRarityWeight('1')).toBeFalsy();
		});

		it('returns true for valid integer 1-5', () => {
			for (let w = 1; w <= 5; w++) {
				expect(isValidRarityWeight(w)).toBeTruthy();
			}
		});

		it('returns false for out of range', () => {
			expect(isValidRarityWeight(0)).toBeFalsy();
			expect(isValidRarityWeight(6)).toBeFalsy();
		});

		it('returns false for non-integer', () => {
			expect(isValidRarityWeight(1.5)).toBeFalsy();
		});
	});
});
