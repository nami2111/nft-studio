import { describe, expect, it } from 'vite-plus/test';
import { ValidationService } from './validation.service';

describe('ValidationService — single-field throws', () => {
	const svc = new ValidationService();

	it('validateProjectName throws on empty', () => {
		expect(() => svc.validateProjectName('')).toThrow();
	});

	it('validateProjectName accepts valid name', () => {
		expect(svc.validateProjectName('My Project')).toBe('My Project');
	});

	it('validateDimensions throws on zero', () => {
		expect(() => svc.validateDimensions({ width: 0, height: 0 })).toThrow();
	});

	it('validateRarityWeight throws on negative', () => {
		expect(() => svc.validateRarityWeight(-1)).toThrow();
	});
});

describe('ValidationService — validateProjectUpdate composition', () => {
	const svc = new ValidationService();

	it('returns valid for empty updates', () => {
		const result = svc.validateProjectUpdate({});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('returns valid for all-valid updates', () => {
		const result = svc.validateProjectUpdate({
			name: 'Test',
			dimensions: { width: 512, height: 512 },
			sellerFeeBasisPoints: 500,
			externalUrl: 'https://example.com'
		});
		expect(result.valid).toBe(true);
	});

	it('aggregates multiple errors instead of throwing on first', () => {
		const result = svc.validateProjectUpdate({
			name: '',
			dimensions: { width: 0, height: 0 },
			sellerFeeBasisPoints: 99999
		});
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(3);
		expect(result.errors.map((e) => e.field).sort()).toEqual(
			['dimensions', 'name', 'sellerFeeBasisPoints'].sort()
		);
	});

	it('validates seller fee bounds', () => {
		expect(svc.validateProjectUpdate({ sellerFeeBasisPoints: -1 }).valid).toBe(false);
		expect(svc.validateProjectUpdate({ sellerFeeBasisPoints: 10001 }).valid).toBe(false);
		expect(svc.validateProjectUpdate({ sellerFeeBasisPoints: 0 }).valid).toBe(true);
		expect(svc.validateProjectUpdate({ sellerFeeBasisPoints: 10000 }).valid).toBe(true);
	});

	it('validates external URL', () => {
		expect(svc.validateProjectUpdate({ externalUrl: 'not-a-url' }).valid).toBe(false);
		expect(svc.validateProjectUpdate({ externalUrl: 'https://example.com' }).valid).toBe(true);
		expect(svc.validateProjectUpdate({ externalUrl: '' }).valid).toBe(true);
	});

	it('validates animation URL', () => {
		expect(svc.validateProjectUpdate({ animationUrl: 'invalid' }).valid).toBe(false);
		expect(svc.validateProjectUpdate({ animationUrl: 'https://x.com/a.mp4' }).valid).toBe(true);
	});

	it('skips fields not in update', () => {
		const result = svc.validateProjectUpdate({ name: 'Valid' });
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});
});

describe('ValidationService — createDefaultProject', () => {
	const svc = new ValidationService();

	it('returns project with required fields', () => {
		const project = svc.createDefaultProject();
		expect(project.id).toBeDefined();
		expect(project.name).toBe('My Collection');
		expect(project.layers).toEqual([]);
		expect(project._needsProperLoad).toBe(true);
	});

	it('returns unique IDs across calls', () => {
		const a = svc.createDefaultProject();
		const b = svc.createDefaultProject();
		expect(a.id).not.toBe(b.id);
	});
});
