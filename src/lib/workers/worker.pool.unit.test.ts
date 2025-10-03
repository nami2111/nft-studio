// Unit tests for enhanced worker pool core functionality
import { describe, it, expect } from 'vitest';
import {
	calculateTaskComplexity,
	TaskComplexity,
	WorkerHealth,
	getDeviceCapabilities
} from './worker.pool';

describe('Enhanced Worker Pool Core Functions', () => {
	it('should calculate task complexity correctly', () => {
		// Test low complexity: small collection, few layers, low resolution
		const lowComplexity = calculateTaskComplexity([], 50, { width: 500, height: 500 });
		expect(lowComplexity).toBe(TaskComplexity.LOW);

		// Test medium complexity: medium collection, medium layers, medium resolution
		const mediumComplexity = calculateTaskComplexity(Array(5).fill({}), 500, {
			width: 800,
			height: 800
		});
		expect(mediumComplexity).toBe(TaskComplexity.MEDIUM);

		// Test high complexity: large collection, many layers, high resolution
		const highComplexity = calculateTaskComplexity(Array(15).fill({}), 3000, {
			width: 1200,
			height: 1200
		});
		expect(highComplexity).toBe(TaskComplexity.HIGH);

		// Test very high complexity: very large collection, many layers, very high resolution
		const veryHighComplexity = calculateTaskComplexity(Array(25).fill({}), 10000, {
			width: 2000,
			height: 2000
		});
		expect(veryHighComplexity).toBe(TaskComplexity.VERY_HIGH);

		// Test edge cases
		const tinyComplexity = calculateTaskComplexity([], 10, { width: 100, height: 100 });
		expect(tinyComplexity).toBe(TaskComplexity.LOW);

		const hugeComplexity = calculateTaskComplexity(Array(50).fill({}), 50000, {
			width: 4000,
			height: 4000
		});
		expect(hugeComplexity).toBe(TaskComplexity.VERY_HIGH);
	});

	it('should get device capabilities', () => {
		const capabilities = getDeviceCapabilities();

		expect(capabilities).toHaveProperty('coreCount');
		expect(capabilities).toHaveProperty('memoryGB');
		expect(capabilities).toHaveProperty('isMobile');
		expect(typeof capabilities.coreCount).toBe('number');
		expect(typeof capabilities.memoryGB).toBe('number');
		expect(typeof capabilities.isMobile).toBe('boolean');
	});

	it('should define worker health states', () => {
		expect(WorkerHealth.HEALTHY).toBe('healthy');
		expect(WorkerHealth.UNRESPONSIVE).toBe('unresponsive');
		expect(WorkerHealth.ERROR).toBe('error');
		expect(WorkerHealth.DEGRADED).toBe('degraded');
	});

	it('should define task complexity levels', () => {
		expect(TaskComplexity.LOW).toBe(1);
		expect(TaskComplexity.MEDIUM).toBe(2);
		expect(TaskComplexity.HIGH).toBe(3);
		expect(TaskComplexity.VERY_HIGH).toBe(4);
	});
});
