import { describe, expect, it } from 'vite-plus/test';
import {
	createLayerId,
	createProjectId,
	createTaskId,
	createTraitId,
	generateLayerId,
	generateProjectId,
	generateTraitId,
	isLayerId,
	isProjectId,
	isTaskId,
	isTraitId,
	isUuid,
	safeCreateLayerId,
	safeCreateProjectId,
	safeCreateTraitId,
	unsafeCreateLayerId,
	unsafeCreateProjectId
} from './ids';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = 'F47AC10B-58CC-4372-A567-0E02B2C3D479';

describe('isUuid', () => {
	it('accepts canonical lowercase UUID', () => {
		expect(isUuid(VALID_UUID)).toBe(true);
	});

	it('accepts uppercase UUID', () => {
		expect(isUuid(VALID_UUID_2)).toBe(true);
	});

	it('rejects empty string', () => {
		expect(isUuid('')).toBe(false);
	});

	it('rejects short ID', () => {
		expect(isUuid('p1')).toBe(false);
	});

	it('rejects malformed UUID', () => {
		expect(isUuid('550e8400-e29b-41d4-a716')).toBe(false);
	});

	it('rejects non-strings', () => {
		expect(isUuid(123)).toBe(false);
		expect(isUuid(null)).toBe(false);
		expect(isUuid(undefined)).toBe(false);
		expect(isUuid({})).toBe(false);
	});
});

describe('Validated factories', () => {
	it('createLayerId accepts valid UUID', () => {
		expect(createLayerId(VALID_UUID)).toBe(VALID_UUID);
	});

	it('createLayerId throws on non-UUID', () => {
		expect(() => createLayerId('not-a-uuid')).toThrow(/Invalid LayerId/);
	});

	it('createTraitId throws on empty string', () => {
		expect(() => createTraitId('')).toThrow();
	});

	it('createProjectId throws on short ID', () => {
		expect(() => createProjectId('p1')).toThrow();
	});

	it('createTaskId accepts UUID', () => {
		expect(createTaskId(VALID_UUID)).toBe(VALID_UUID);
	});
});

describe('Safe factories', () => {
	it('safeCreateLayerId returns ID for valid UUID', () => {
		expect(safeCreateLayerId(VALID_UUID)).toBe(VALID_UUID);
	});

	it('safeCreateLayerId returns null for invalid', () => {
		expect(safeCreateLayerId('bad')).toBeNull();
	});

	it('safeCreateTraitId returns null for invalid', () => {
		expect(safeCreateTraitId('')).toBeNull();
	});

	it('safeCreateProjectId returns null for invalid', () => {
		expect(safeCreateProjectId('not-uuid')).toBeNull();
	});
});

describe('Unsafe factories (test-only)', () => {
	it('unsafeCreateLayerId skips validation', () => {
		expect(unsafeCreateLayerId('short')).toBe('short');
	});

	it('unsafeCreateProjectId skips validation', () => {
		expect(unsafeCreateProjectId('p1')).toBe('p1');
	});
});

describe('Type guards', () => {
	it('isLayerId requires UUID format', () => {
		expect(isLayerId(VALID_UUID)).toBe(true);
		expect(isLayerId('short')).toBe(false);
		expect(isLayerId('')).toBe(false);
	});

	it('isTraitId requires UUID format', () => {
		expect(isTraitId(VALID_UUID)).toBe(true);
		expect(isTraitId('short')).toBe(false);
	});

	it('isProjectId requires UUID format', () => {
		expect(isProjectId(VALID_UUID)).toBe(true);
		expect(isProjectId('p1')).toBe(false);
	});

	it('isTaskId requires UUID format', () => {
		expect(isTaskId(VALID_UUID)).toBe(true);
		expect(isTaskId('task1')).toBe(false);
	});
});

describe('Generators produce valid UUIDs', () => {
	it('generateLayerId returns valid UUID', () => {
		expect(isUuid(generateLayerId())).toBe(true);
	});

	it('generateTraitId returns valid UUID', () => {
		expect(isUuid(generateTraitId())).toBe(true);
	});

	it('generateProjectId returns valid UUID', () => {
		expect(isUuid(generateProjectId())).toBe(true);
	});

	it('generated IDs pass validated factories', () => {
		expect(() => createLayerId(generateLayerId())).not.toThrow();
		expect(() => createTraitId(generateTraitId())).not.toThrow();
		expect(() => createProjectId(generateProjectId())).not.toThrow();
	});

	it('generated IDs are unique', () => {
		const a = generateLayerId();
		const b = generateLayerId();
		expect(a).not.toBe(b);
	});
});
