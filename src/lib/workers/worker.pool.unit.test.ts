// Unit tests for enhanced worker pool core functionality
import { describe, it, expect } from 'vite-plus/test';
import { WorkerHealth, getDeviceCapabilities } from './pool';

describe('Enhanced Worker Pool Core Functions', () => {
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
});
