/**
 * Test suite for typed error classes and helpers.
 *
 * @module typed-errors.test
 */

import { describe, expect, it } from 'vite-plus/test';
import {
	ApiError,
	AppError,
	ConfigurationError,
	FileError,
	FileReadError,
	FileStorageError,
	FileWriteError,
	GenerationError,
	GenerationExecutionError,
	GenerationValidationError,
	getErrorInfo,
	ImageProcessingError,
	isConfigurationError,
	isFileError,
	isGenerationError,
	isNetworkError,
	isRecoverableError,
	isStorageError,
	isValidationError,
	isWorkerError,
	LayerValidationError,
	LocalStorageError,
	NetworkError,
	ProjectValidationError,
	StorageError,
	TraitValidationError,
	ValidationError,
	WorkerError,
	WorkerExecutionError,
	WorkerInitializationError,
	WorkerTimeoutError
} from './typed-errors';

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

describe('ValidationError hierarchy', () => {
	it('ValidationError is recoverable', () => {
		const err = new ValidationError('invalid');
		expect(err.code).toBe('VALIDATION_ERROR');
		expect(err.recoverable).toBe(true);
		expect(err).toBeInstanceOf(AppError);
		expect(err).toBeInstanceOf(ValidationError);
	});

	it('ProjectValidationError includes projectId', () => {
		const err = new ProjectValidationError('bad project', 'proj-1' as never);
		expect(err.code).toBe('VALIDATION_ERROR');
		expect(err.context).toEqual({ projectId: 'proj-1' });
		expect(err).toBeInstanceOf(ValidationError);
	});

	it('LayerValidationError includes layerId', () => {
		const err = new LayerValidationError('bad layer', 'layer-1' as never);
		expect(err.context).toEqual({ layerId: 'layer-1' });
		expect(err).toBeInstanceOf(ValidationError);
	});

	it('TraitValidationError includes traitId', () => {
		const err = new TraitValidationError('bad trait', 'trait-1' as never);
		expect(err.context).toEqual({ traitId: 'trait-1' });
		expect(err).toBeInstanceOf(ValidationError);
	});
});

describe('StorageError hierarchy', () => {
	it('StorageError includes storage type in context', () => {
		const err = new StorageError('storage fail');
		expect(err.code).toBe('STORAGE_ERROR');
		expect(err.recoverable).toBe(true);
		expect(err).toBeInstanceOf(AppError);
	});

	it('LocalStorageError tags storageType', () => {
		const err = new LocalStorageError('ls fail');
		expect(err.context).toEqual({ storageType: 'localStorage' });
		expect(err).toBeInstanceOf(StorageError);
	});

	it('FileStorageError tags storageType', () => {
		const err = new FileStorageError('fs fail');
		expect(err.context).toEqual({ storageType: 'file' });
		expect(err).toBeInstanceOf(StorageError);
	});
});

describe('FileError hierarchy', () => {
	it('FileError base sets FILE_ERROR code', () => {
		const err = new FileError('file issue');
		expect(err.code).toBe('FILE_ERROR');
		expect(err.recoverable).toBe(true);
	});

	it('FileReadError tags operation as read', () => {
		const err = new FileReadError('cannot read');
		expect(err.context).toMatchObject({ operation: 'read' });
		expect(err).toBeInstanceOf(FileError);
	});

	it('FileWriteError tags operation as write', () => {
		const err = new FileWriteError('cannot write');
		expect(err.context).toMatchObject({ operation: 'write' });
		expect(err).toBeInstanceOf(FileError);
	});

	it('ImageProcessingError tags operation', () => {
		const err = new ImageProcessingError('bad image');
		expect(err.context).toMatchObject({ operation: 'image_processing' });
		expect(err).toBeInstanceOf(FileError);
	});
});

describe('WorkerError hierarchy', () => {
	it('WorkerError base sets WORKER_ERROR code', () => {
		const err = new WorkerError('worker fail');
		expect(err.code).toBe('WORKER_ERROR');
		expect(err.recoverable).toBe(true);
	});

	it('WorkerInitializationError tags phase', () => {
		const err = new WorkerInitializationError('init fail');
		expect(err.context).toMatchObject({ phase: 'initialization' });
		expect(err).toBeInstanceOf(WorkerError);
	});

	it('WorkerExecutionError includes taskId', () => {
		const err = new WorkerExecutionError('exec fail', 'task-1' as never);
		expect(err.context).toMatchObject({ taskId: 'task-1', phase: 'execution' });
		expect(err).toBeInstanceOf(WorkerError);
	});

	it('WorkerTimeoutError includes taskId', () => {
		const err = new WorkerTimeoutError('timeout', 'task-2' as never);
		expect(err.context).toMatchObject({ taskId: 'task-2', phase: 'timeout' });
		expect(err).toBeInstanceOf(WorkerError);
	});
});

describe('GenerationError hierarchy', () => {
	it('GenerationError base sets GENERATION_ERROR code', () => {
		const err = new GenerationError('gen fail');
		expect(err.code).toBe('GENERATION_ERROR');
		expect(err.recoverable).toBe(true);
	});

	it('GenerationValidationError tags type', () => {
		const err = new GenerationValidationError('gen validation');
		expect(err.context).toMatchObject({ type: 'validation' });
		expect(err).toBeInstanceOf(GenerationError);
	});

	it('GenerationExecutionError tags type', () => {
		const err = new GenerationExecutionError('gen exec');
		expect(err.context).toMatchObject({ type: 'execution' });
		expect(err).toBeInstanceOf(GenerationError);
	});
});

describe('NetworkError hierarchy', () => {
	it('NetworkError sets NETWORK_ERROR code', () => {
		const err = new NetworkError('net fail');
		expect(err.code).toBe('NETWORK_ERROR');
		expect(err.recoverable).toBe(true);
	});

	it('ApiError includes statusCode', () => {
		const err = new ApiError('api fail', 404);
		expect(err.context).toMatchObject({ statusCode: 404 });
		expect(err).toBeInstanceOf(NetworkError);
	});
});

describe('ConfigurationError', () => {
	it('is not recoverable by default', () => {
		const err = new ConfigurationError('bad config');
		expect(err.code).toBe('CONFIGURATION_ERROR');
		expect(err.recoverable).toBe(false);
		expect(err).toBeInstanceOf(AppError);
	});
});

describe('Type guards', () => {
	it('isValidationError matches correctly', () => {
		expect(isValidationError(new ValidationError('x'))).toBe(true);
		expect(isValidationError(new ProjectValidationError('x', 'id' as never))).toBe(true);
		expect(isValidationError(new Error('plain'))).toBe(false);
		expect(isValidationError('string')).toBe(false);
		expect(isValidationError(null)).toBe(false);
	});

	it('isStorageError matches correctly', () => {
		expect(isStorageError(new StorageError('x'))).toBe(true);
		expect(isStorageError(new LocalStorageError('x'))).toBe(true);
		expect(isStorageError(new Error('plain'))).toBe(false);
	});

	it('isFileError matches correctly', () => {
		expect(isFileError(new FileError('x'))).toBe(true);
		expect(isFileError(new FileReadError('x'))).toBe(true);
		expect(isFileError(new AppError('x', 'CODE'))).toBe(false);
	});

	it('isWorkerError matches correctly', () => {
		expect(isWorkerError(new WorkerError('x'))).toBe(true);
		expect(isWorkerError(new WorkerTimeoutError('x', 't' as never))).toBe(true);
		expect(isWorkerError(new Error('plain'))).toBe(false);
	});

	it('isGenerationError matches correctly', () => {
		expect(isGenerationError(new GenerationError('x'))).toBe(true);
		expect(isGenerationError(new GenerationExecutionError('x'))).toBe(true);
		expect(isGenerationError(new AppError('x', 'CODE'))).toBe(false);
	});

	it('isNetworkError matches correctly', () => {
		expect(isNetworkError(new NetworkError('x'))).toBe(true);
		expect(isNetworkError(new ApiError('x', 500))).toBe(true);
		expect(isNetworkError(new Error('plain'))).toBe(false);
	});

	it('isConfigurationError matches correctly', () => {
		expect(isConfigurationError(new ConfigurationError('x'))).toBe(true);
		expect(isConfigurationError(new AppError('x', 'CODE'))).toBe(false);
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
		expect(isRecoverableError(new ValidationError('x'))).toBe(true);
		expect(isRecoverableError(new StorageError('x'))).toBe(true);
		expect(isRecoverableError(new NetworkError('x'))).toBe(true);
	});

	it('returns false for non-recoverable AppErrors', () => {
		expect(isRecoverableError(new ConfigurationError('x'))).toBe(false);
	});

	it('returns true for unknown errors (safe default)', () => {
		expect(isRecoverableError(new Error('plain'))).toBe(true);
		expect(isRecoverableError('string')).toBe(true);
		expect(isRecoverableError(null)).toBe(true);
	});
});
