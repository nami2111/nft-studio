import { describe, it, expect } from 'vite-plus/test';
import { sanitizeForClone, safeStructuredClone } from '../sanitize';

describe('sanitizeForClone', () => {
	it('preserves primitives', () => {
		expect(sanitizeForClone('hello')).toBe('hello');
		expect(sanitizeForClone(42)).toBe(42);
		expect(sanitizeForClone(true)).toBe(true);
		expect(sanitizeForClone(null)).toBeNull();
		expect(sanitizeForClone(undefined)).toBeUndefined();
		expect(sanitizeForClone(BigInt(123))).toBe(BigInt(123));
	});

	it('removes functions and symbols', () => {
		const result = sanitizeForClone({ fn: () => 1, sym: Symbol('x'), val: 42 });
		expect(result).toEqual({ val: 42 });
	});

	it('deep-clones ArrayBuffer via slice', () => {
		const buf = new ArrayBuffer(8);
		const view = new Uint8Array(buf);
		view[0] = 42;
		const cloned = sanitizeForClone(buf) as ArrayBuffer;
		expect(cloned.byteLength).toBe(8);
		const clonedView = new Uint8Array(cloned);
		expect(clonedView[0]).toBe(42);
		// Modify original, cloned should be unaffected (slice creates copy)
		view[0] = 0;
		expect(clonedView[0]).toBe(42);
	});

	it('handles Map correctly', () => {
		const map = new Map<string, number>([
			['a', 1],
			['b', 2]
		]);
		const result = sanitizeForClone(map) as Map<string, number>;
		expect(result.get('a')).toBe(1);
		expect(result.get('b')).toBe(2);
		expect(result.size).toBe(2);
	});

	it('handles Set correctly', () => {
		const set = new Set([1, 2, 3]);
		const result = sanitizeForClone(set) as Set<number>;
		expect(result.has(1)).toBe(true);
		expect(result.size).toBe(3);
	});

	it('converts class instances to plain objects', () => {
		class Person {
			constructor(
				public name: string,
				public age: number
			) {}
		}
		const instance = new Person('Alice', 30);
		const result = sanitizeForClone(instance) as Record<string, unknown>;
		expect(result.name).toBe('Alice');
		expect(result.age).toBe(30);
		// constructor is not an own property on class instances
		expect(Object.hasOwn(result, 'constructor')).toBe(false);
	});

	it('handles nested objects', () => {
		const obj = { a: { b: { c: [1, 2, { d: 'deep' }] } } };
		const result = sanitizeForClone(obj) as typeof obj;
		expect(result).toEqual(obj);
	});

	it('handles arrays containing non-cloneable values', () => {
		const arr = [1, () => 'fn', 'two', Symbol('s')];
		const result = sanitizeForClone(arr) as unknown[];
		// Functions and symbols become undefined but array length is preserved
		expect(result[0]).toBe(1);
		expect(result[1]).toBeUndefined();
		expect(result[2]).toBe('two');
		expect(result[3]).toBeUndefined();
	});

	it('preserves Date and RegExp instances', () => {
		const date = new Date('2024-01-01');
		const regex = /test/gi;
		const result = sanitizeForClone({ date, regex }) as Record<string, unknown>;
		expect(result.date).toBe(date);
		expect(result.regex).toBe(regex);
	});

	it('stops recursion at depth limit', () => {
		let obj: Record<string, unknown> = {};
		let current = obj;
		for (let i = 0; i < 60; i++) {
			current.nested = {};
			current = current.nested as Record<string, unknown>;
		}
		// Should not throw — safety valve prevents stack overflow
		expect(() => sanitizeForClone(obj)).not.toThrow();
	});

	it('handles empty values', () => {
		expect(sanitizeForClone({})).toEqual({});
		expect(sanitizeForClone([])).toEqual([]);
		expect(sanitizeForClone(new Map())).toEqual(new Map());
		expect(sanitizeForClone(new Set())).toEqual(new Set());
	});

	it('handles objects with accessor properties', () => {
		const obj = {
			_name: 'test',
			get name() {
				return this._name;
			}
		};
		const result = sanitizeForClone(obj) as Record<string, unknown>;
		// For plain objects, Object.keys includes accessor keys and the getter is invoked.
		// The result value is the getter's return value.
		expect(result._name).toBe('test');
		expect(result.name).toBe('test');
	});
});

describe('safeStructuredClone', () => {
	it('clones plain objects without fallback', () => {
		const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
		const result = safeStructuredClone(obj);
		expect(result).toEqual(obj);
	});

	it('falls back to sanitizeForClone on DataCloneError', () => {
		// A class with a private field triggers DataCloneError in structuredClone
		class WithPrivate {
			#secret = 'hidden';
			public value = 42;
			getSecret() {
				return this.#secret;
			}
		}
		const instance = new WithPrivate();
		// Should not throw — falls back to sanitize
		let result: Record<string, unknown> | undefined;
		expect(() => {
			result = safeStructuredClone(instance) as Record<string, unknown>;
		}).not.toThrow();
		expect(result!.value).toBe(42);
	});
});
