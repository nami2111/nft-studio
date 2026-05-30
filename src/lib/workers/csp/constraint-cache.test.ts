import { describe, expect, it } from 'vite-plus/test';
import { ConstraintCache } from './constraint-cache';

describe('ConstraintCache', () => {
	it('returns undefined for missing key and counts access', () => {
		const cache = new ConstraintCache();
		expect(cache.get('t1', 'l1', 'l2')).toBeUndefined();
		expect(cache.accessCount).toBe(1);
		expect(cache.hitRate).toBe(0);
	});

	it('returns stored set on hit and updates hit rate', () => {
		const cache = new ConstraintCache();
		cache.set('t1', 'l1', 'l2', new Set(['x', 'y']));

		const hit = cache.get('t1', 'l1', 'l2');
		expect(hit).toEqual(new Set(['x', 'y']));
		expect(cache.accessCount).toBe(1);
		expect(cache.hitRate).toBe(100);
	});

	it('isolates keys by source layer + trait + target', () => {
		const cache = new ConstraintCache();
		cache.set('t1', 'l1', 'l2', new Set(['x']));
		cache.set('t1', 'l1', 'l3', new Set(['y']));

		expect(cache.get('t1', 'l1', 'l2')).toEqual(new Set(['x']));
		expect(cache.get('t1', 'l1', 'l3')).toEqual(new Set(['y']));
	});

	it('clones the set on set so external mutation does not poison cache', () => {
		const cache = new ConstraintCache();
		const original = new Set(['x']);
		cache.set('t1', 'l1', 'l2', original);
		original.add('y');

		expect(cache.get('t1', 'l1', 'l2')).toEqual(new Set(['x']));
	});

	it('clear resets stats and storage', () => {
		const cache = new ConstraintCache();
		cache.set('t1', 'l1', 'l2', new Set(['x']));
		cache.get('t1', 'l1', 'l2');

		cache.clear();
		expect(cache.compatiblePairs.size).toBe(0);
		expect(cache.accessCount).toBe(0);
		expect(cache.hitRate).toBe(0);
	});

	it('getStats reports cache size and hit rate (note: rate only updates on hit)', () => {
		const cache = new ConstraintCache();
		cache.set('t1', 'l1', 'l2', new Set(['x']));
		cache.set('t2', 'l1', 'l2', new Set(['y']));
		cache.get('t1', 'l1', 'l2');
		cache.get('t2', 'l1', 'l2');

		const stats = cache.getStats();
		expect(stats.cacheSize).toBe(2);
		expect(stats.hits).toBe(2);
		expect(stats.accessCount).toBe(2);
		expect(stats.hitRate).toBe('100.0');
	});
});
