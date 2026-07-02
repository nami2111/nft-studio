/**
 * Test suite for retry utilities.
 *
 * @module retry.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { RetryConditions, RetryConfigs, RetryOperation, retry } from './retry';

describe('RetryOperation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('succeeds on first attempt', async () => {
		const op = vi.fn().mockResolvedValue('success');
		const retryOp = new RetryOperation(op, { maxAttempts: 3 });

		const result = await retryOp.execute();

		expect(result.success).toBe(true);
		expect(result.data).toBe('success');
		expect(result.attempts).toBe(1);
		expect(op).toHaveBeenCalledTimes(1);
	});

	it('retries on failure until success', async () => {
		const op = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail 1'))
			.mockRejectedValueOnce(new Error('fail 2'))
			.mockResolvedValue('success');

		const retryOp = new RetryOperation(op, {
			maxAttempts: 5,
			initialDelayMs: 1000,
			backoffFactor: 2,
			jitter: false
		});
		const promise = retryOp.execute();

		// Advance past first delay (1000ms)
		await vi.advanceTimersByTimeAsync(1000);
		// Advance past second delay (2000ms due to backoff)
		await vi.advanceTimersByTimeAsync(2000);

		const result = await promise;

		expect(result.success).toBe(true);
		expect(result.data).toBe('success');
		expect(result.attempts).toBe(3);
		expect(op).toHaveBeenCalledTimes(3);
	});

	it('fails after max attempts', async () => {
		const op = vi.fn().mockRejectedValue(new Error('always fails'));
		const retryOp = new RetryOperation(op, {
			maxAttempts: 3,
			initialDelayMs: 100,
			jitter: false
		});

		const promise = retryOp.execute();
		await vi.advanceTimersByTimeAsync(100); // attempt 2 delay
		await vi.advanceTimersByTimeAsync(200); // attempt 3 delay
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(Error);
		expect((result.error as Error).message).toBe('always fails');
		expect(result.attempts).toBe(3);
		expect(op).toHaveBeenCalledTimes(3);
	});

	it('respects retry condition — stops early', async () => {
		const nonRetryableError = new Error('non-retryable');
		const op = vi.fn().mockRejectedValue(nonRetryableError);
		const retryCondition = vi.fn().mockReturnValue(false);

		const retryOp = new RetryOperation(op, {
			maxAttempts: 5,
			initialDelayMs: 100,
			jitter: false,
			retryCondition
		});

		const promise = retryOp.execute();
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.attempts).toBe(1); // retryCondition false → stops after 1st attempt
		expect(retryCondition).toHaveBeenCalledWith(nonRetryableError);
		expect(op).toHaveBeenCalledTimes(1); // only first attempt
	});

	it('calls onRetry callback on each retry', async () => {
		const op = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail'))
			.mockRejectedValueOnce(new Error('fail'))
			.mockResolvedValue('ok');
		const onRetry = vi.fn();

		const retryOp = new RetryOperation(op, {
			maxAttempts: 3,
			initialDelayMs: 100,
			jitter: false,
			onRetry
		});

		const promise = retryOp.execute();
		await vi.advanceTimersByTimeAsync(100);
		await vi.advanceTimersByTimeAsync(200);
		await promise;

		expect(onRetry).toHaveBeenCalledTimes(2);
	});

	it('calls onFinalFailure after exhausting retries', async () => {
		const op = vi.fn().mockRejectedValue(new Error('final fail'));
		const onFinalFailure = vi.fn();

		const retryOp = new RetryOperation(op, {
			maxAttempts: 2,
			initialDelayMs: 100,
			jitter: false,
			onFinalFailure
		});

		const promise = retryOp.execute();
		await vi.advanceTimersByTimeAsync(100);
		await promise;

		expect(onFinalFailure).toHaveBeenCalledTimes(1);
		expect(onFinalFailure).toHaveBeenCalledWith(expect.any(Error));
	});

	it('caps delay at maxDelayMs', async () => {
		const op = vi.fn().mockRejectedValue(new Error('fail'));
		const retryOp = new RetryOperation(op, {
			maxAttempts: 3,
			initialDelayMs: 10000,
			maxDelayMs: 5000,
			backoffFactor: 2,
			jitter: false
		});

		const promise = retryOp.execute();

		// First delay: min(10000 * 1, 5000) = 5000
		await vi.advanceTimersByTimeAsync(5000);
		// Second delay: min(10000 * 2, 5000) = 5000
		await vi.advanceTimersByTimeAsync(5000);

		const result = await promise;
		expect(result.attempts).toBe(3); // all attempts made
	});

	it('tracks total duration', async () => {
		const op = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

		const retryOp = new RetryOperation(op, {
			maxAttempts: 3,
			initialDelayMs: 100,
			jitter: false
		});

		const promise = retryOp.execute();
		await vi.advanceTimersByTimeAsync(100);
		const result = await promise;

		expect(result.totalDurationMs).toBeGreaterThanOrEqual(100);
	}, 10000);
});

describe('retry() convenience function', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns success result', async () => {
		const result = await retry(() => Promise.resolve('data'), {
			maxAttempts: 3,
			initialDelayMs: 100,
			jitter: false
		});

		expect(result.success).toBe(true);
		expect(result.data).toBe('data');
	});
});

describe('RetryConditions', () => {
	it('isNetworkError detects network failures', () => {
		expect(RetryConditions.isNetworkError(new Error('network error'))).toBe(true);
		expect(RetryConditions.isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
		expect(RetryConditions.isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
		expect(RetryConditions.isNetworkError(new TypeError('fetch failed'))).toBe(true);
		expect(RetryConditions.isNetworkError(new Error('other'))).toBe(false);
		expect(RetryConditions.isNetworkError('string')).toBe(false);
	});

	it('isServerError detects 5xx statuses', () => {
		expect(RetryConditions.isServerError({ status: 500 })).toBe(true);
		expect(RetryConditions.isServerError({ status: 503 })).toBe(true);
		expect(RetryConditions.isServerError({ status: 400 })).toBe(false);
		expect(RetryConditions.isServerError({ status: 200 })).toBe(false);
		expect(RetryConditions.isServerError(new Error('x'))).toBe(false);
	});

	it('isRateLimitError detects 429', () => {
		expect(RetryConditions.isRateLimitError({ status: 429 })).toBe(true);
		expect(RetryConditions.isRateLimitError({ status: 500 })).toBe(false);
	});

	it('isTimeoutError detects timeout messages', () => {
		expect(RetryConditions.isTimeoutError(new Error('timeout'))).toBe(true);
		expect(RetryConditions.isTimeoutError(new Error('TIMEDOUT'))).toBe(true);
		const timeoutErr = new Error('operation timeout');
		timeoutErr.name = 'TimeoutError';
		expect(RetryConditions.isTimeoutError(timeoutErr)).toBe(true);
		expect(RetryConditions.isTimeoutError(new Error('other'))).toBe(false);
	});

	it('isResourceUnavailable detects unavailable/busy', () => {
		expect(RetryConditions.isResourceUnavailable(new Error('service unavailable'))).toBe(true);
		expect(RetryConditions.isResourceUnavailable(new Error('system busy'))).toBe(true);
		expect(RetryConditions.isResourceUnavailable(new Error('overloaded'))).toBe(true);
		expect(RetryConditions.isResourceUnavailable(new Error('all good'))).toBe(false);
	});

	it('isRecoverable combines all conditions', () => {
		expect(RetryConditions.isRecoverable(new Error('network error'))).toBe(true);
		expect(RetryConditions.isRecoverable({ status: 503 })).toBe(true);
		expect(RetryConditions.isRecoverable({ status: 429 })).toBe(true);
		expect(RetryConditions.isRecoverable(new Error('timeout'))).toBe(true);
		expect(RetryConditions.isRecoverable(new Error('service unavailable'))).toBe(true);
		expect(RetryConditions.isRecoverable(new Error('completely unknown'))).toBe(false);
	});
});

describe('RetryConfigs presets', () => {
	it('network preset has reasonable defaults', () => {
		expect(RetryConfigs.network.maxAttempts).toBe(3);
		expect(RetryConfigs.network.initialDelayMs).toBe(1000);
		expect(RetryConfigs.network.retryCondition).toBe(RetryConditions.isNetworkError);
	});

	it('rateLimit preset has more attempts', () => {
		expect(RetryConfigs.rateLimit.maxAttempts).toBe(10);
		expect(RetryConfigs.rateLimit.backoffFactor).toBe(1.5);
	});
});
