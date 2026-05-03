/**
 * Test suite for error-handler utilities.
 *
 * @module error-handler.test
 */

import { describe, expect, it, vi } from 'vite-plus/test';
import {
	createTypedError,
	getDetailedErrorInfo,
	isErrorRecoverable,
	withSafeOperation
} from './error-handler';
import { AppError, ConfigurationError, NetworkError, ValidationError } from './typed-errors';

// Mock showError from sibling module to avoid toast dependency
vi.mock('./error-handling', () => ({
	showError: vi.fn(),
	showSuccess: vi.fn(),
	showInfo: vi.fn(),
	showWarning: vi.fn()
}));

describe('isErrorRecoverable', () => {
	it('returns true for recoverable AppErrors', () => {
		expect(isErrorRecoverable(new ValidationError('invalid'))).toBe(true);
		expect(isErrorRecoverable(new NetworkError('down'))).toBe(true);
		expect(isErrorRecoverable(new AppError('msg', 'CODE', {}, true))).toBe(true);
	});

	it('returns false for non-recoverable AppErrors', () => {
		expect(isErrorRecoverable(new ConfigurationError('bad'))).toBe(false);
		expect(isErrorRecoverable(new AppError('msg', 'CODE', {}, false))).toBe(false);
	});

	it('returns true for unknown errors (safe default)', () => {
		expect(isErrorRecoverable(new Error('plain'))).toBe(true);
		expect(isErrorRecoverable('string')).toBe(true);
		expect(isErrorRecoverable(42)).toBe(true);
		expect(isErrorRecoverable(null)).toBe(true);
	});
});

describe('getDetailedErrorInfo', () => {
	it('returns detailed info for AppError', () => {
		const err = new AppError('test msg', 'TEST', { key: 'val' });
		const info = getDetailedErrorInfo(err);

		expect(info.name).toBe('AppError');
		expect(info.code).toBe('TEST');
		expect(info.context).toEqual({ key: 'val' });
		expect(info.recoverable).toBe(false);
		expect(info.message).toBe('test msg');
		expect(typeof info.stack).toBe('string');
	});

	it('returns basic info for plain Error', () => {
		const info = getDetailedErrorInfo(new Error('plain'));

		expect(info.name).toBe('Error');
		expect(info.message).toBe('plain');
		expect(info.code).toBeUndefined();
		expect(info.context).toBeUndefined();
	});

	it('handles non-Error values', () => {
		const info = getDetailedErrorInfo('whoops');

		expect(info.name).toBe('UnknownError');
		expect(info.message).toBe('whoops');
	});
});

describe('createTypedError', () => {
	it('returns the same error if already AppError', () => {
		const original = new ValidationError('bad');
		const result = createTypedError(original);
		expect(result).toBe(original);
		expect(result).toBeInstanceOf(ValidationError);
	});

	it('wraps plain Error into AppError with CONVERTED_ERROR code', () => {
		const err = createTypedError(new Error('something broke'));
		expect(err).toBeInstanceOf(AppError);
		expect(err.code).toBe('CONVERTED_ERROR');
		expect(err.message).toBe('something broke');
	});

	it('adds context to converted error', () => {
		const err = createTypedError(new Error('oops'), { field: 'email' });
		expect(err.context).toEqual({ field: 'email' });
	});
});

describe('withSafeOperation', () => {
	it('returns result on success', async () => {
		const result = await withSafeOperation(() => Promise.resolve(42));
		expect(result).toBe(42);
	});

	it('rethrows on error by default', async () => {
		await expect(
			withSafeOperation(() => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
	});

	it('returns fallback value when configured', async () => {
		const result = await withSafeOperation(
			() => {
				throw new Error('boom');
			},
			{ fallbackValue: 'fallback', silent: true }
		);
		expect(result).toBe('fallback');
	});
});
