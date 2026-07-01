/**
 * Test suite for typed error classes and helpers.
 *
 * @module typed-errors.test
 */

import { describe, expect, it } from 'vite-plus/test';
import { AppError, ErrorCodes, getErrorInfo, isRecoverableError } from './typed-errors';

describe('AppError', () => {
	it('creates an error with correct properties', () => {
		const err = new AppError('test message', 'TEST_CODE', { key: 'val' }, false);

		expect(err.message).toBe('test message');
		expect(err.code).toBe('TEST_CODE');
		expect(err.context).toEqual({ key: 'val' });
		expect(err.recoverable).toBe(false);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AppError);
		expect(err.timestamp).toBeInstanceOf(Date);
	});

	it('defaults recoverable to false', () => {
		const err = new AppError('msg', 'CODE');
		expect(err.recoverable).toBe(false);
	});

	it('context is optional', () => {
		const err = new AppError('msg', 'CODE');
		expect(err.context).toBeUndefined();
	});

	it('toJSON returns serializable object', () => {
		const err = new AppError('test', 'TEST', { key: 'val' });
		const json = err.toJSON();

		expect(json.name).toBe('AppError');
		expect(json.message).toBe('test');
		expect(json.code).toBe('TEST');
		expect(json.context).toEqual({ key: 'val' });
		expect(json.recoverable).toBe(false);
		expect(typeof json.timestamp).toBe('string');
		expect(typeof json.stack).toBe('string');
	});
});

describe('ErrorCodes', () => {
	it('contains expected codes', () => {
		expect(ErrorCodes.STORAGE_ERROR).toBe('STORAGE_ERROR');
		expect(ErrorCodes.FILE_ERROR).toBe('FILE_ERROR');
		expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
		expect(ErrorCodes.WORKER_ERROR).toBe('WORKER_ERROR');
		expect(ErrorCodes.GENERATION_ERROR).toBe('GENERATION_ERROR');
		expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
		expect(ErrorCodes.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
	});
});

describe('getErrorInfo', () => {
	it('extracts all fields from AppError', () => {
		const err = new AppError('test', 'CODE', { key: 'val' });
		const info = getErrorInfo(err);

		expect(info.name).toBe('AppError');
		expect(info.message).toBe('test');
		expect(info.code).toBe('CODE');
		expect(info.context).toEqual({ key: 'val' });
		expect(info.recoverable).toBe(false);
		expect(typeof info.stack).toBe('string');
	});

	it('extracts basic info from plain Error', () => {
		const err = new Error('plain error');
		const info = getErrorInfo(err);

		expect(info.name).toBe('Error');
		expect(info.message).toBe('plain error');
		expect(info.code).toBeUndefined();
		expect(info.context).toBeUndefined();
	});

	it('handles non-Error values', () => {
		const info = getErrorInfo('string error');

		expect(info.name).toBe('UnknownError');
		expect(info.message).toBe('string error');
		expect(info.code).toBeUndefined();
	});
});

describe('isRecoverableError', () => {
	it('returns true for recoverable AppErrors', () => {
		expect(isRecoverableError(new AppError('x', ErrorCodes.VALIDATION_ERROR, {}, true))).toBe(true);
		expect(isRecoverableError(new AppError('x', ErrorCodes.STORAGE_ERROR, {}, true))).toBe(true);
		expect(isRecoverableError(new AppError('x', ErrorCodes.NETWORK_ERROR, {}, true))).toBe(true);
	});

	it('returns false for non-recoverable AppErrors', () => {
		expect(isRecoverableError(new AppError('x', ErrorCodes.CONFIGURATION_ERROR))).toBe(false);
	});

	it('returns true for unknown errors (safe default)', () => {
		expect(isRecoverableError(new Error('plain'))).toBe(true);
		expect(isRecoverableError('string')).toBe(true);
		expect(isRecoverableError(null)).toBe(true);
	});
});
