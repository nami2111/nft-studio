/**
 * Walk a value and replace any non-cloneable class instances with plain
 * object copies (preserving enumerable own properties). Catches cases
 * where compiled TS `private` fields become JS `#` private fields that
 * `structuredClone` rejects.
 *
 *   - ArrayBuffer  →  .slice(0)  (deep copy, safe for transfer)
 *   - Map / Set    →  preserved  (native structuredClone handles them)
 *   - class instances (constructor !== Object && !== Array)  →  plain {}
 *   - Functions / Symbols  →  removed (replaced with undefined)
 */
export function sanitizeForClone(value: unknown, depth = 0): unknown {
	if (depth > 50) return value; // safety valve

	if (value === null || value === undefined) return value;

	// Primitives — return as-is
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return value;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value;

	// Skip non-cloneable leaf types
	if (typeof value === 'function') return undefined;
	if (typeof value === 'symbol') return undefined;

	// ArrayBuffer — safe for structuredClone but we re-slice to be defensive
	if (value instanceof ArrayBuffer) {
		return value.byteLength > 0 ? value.slice(0) : value;
	}
	if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
		return value;
	}

	// TypedArrays — return underlying buffer slice instead (avoids detached-buffer issues)
	if (ArrayBuffer.isView(value)) {
		const isShared =
			typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer;
		const buf = isShared ? value.buffer : value.buffer.slice(0);
		return buf;
	}

	// Native types that structuredClone handles — trust them
	if (value instanceof Date) return value;
	if (value instanceof RegExp) return value;
	if (value instanceof Blob) return value;
	if (typeof ImageData !== 'undefined' && value instanceof ImageData) return value;
	if (value instanceof Map) {
		const out = new Map();
		for (const [k, v] of value) {
			out.set(sanitizeForClone(k, depth + 1), sanitizeForClone(v, depth + 1));
		}
		return out;
	}
	if (value instanceof Set) {
		const out = new Set();
		for (const v of value) {
			out.add(sanitizeForClone(v, depth + 1));
		}
		return out;
	}

	// Arrays — recurse
	if (Array.isArray(value)) {
		const out: unknown[] = [];
		for (let i = 0; i < value.length; i++) {
			out[i] = sanitizeForClone(value[i], depth + 1);
		}
		return out;
	}

	// Plain objects — friendly to structuredClone
	const ctor = (value as object).constructor;
	if (ctor === Object || ctor === undefined) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>)) {
			const v = sanitizeForClone((value as Record<string, unknown>)[key], depth + 1);
			if (v !== undefined) {
				out[key] = v;
			}
		}
		return out;
	}

	// ★ Class instances (including Svelte reactive proxies, SvelteMap, SvelteSet,
	//   solver-internal objects, etc.) — convert to plain object.
	//   Svelte 5 proxies can have `constructor !== Object` and may carry
	//   `#` private fields that structuredClone rejects.
	const out: Record<string, unknown> = {};
	const descs = Object.getOwnPropertyDescriptors(value as object);
	for (const key of Object.keys(descs)) {
		const desc = descs[key];
		if (desc.get || desc.set) {
			// Accessor properties — skip (may reference private fields)
			continue;
		}
		const v = sanitizeForClone(desc.value, depth + 1);
		if (v !== undefined) {
			out[key] = v;
		}
	}
	return out;
}

/**
 * Safe structuredClone that falls back to manual sanitization when
 * the payload contains non-cloneable objects (class instances with
 * `#` private fields, Svelte proxies, etc.).
 */
export function safeStructuredClone<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch (_err) {
		if (_err instanceof DOMException && _err.name === 'DataCloneError') {
			if (import.meta.env.DEV) {
				console.debug(
					'[worker.pool] structuredClone failed, falling back to safe clone:',
					_err.message
				);
			}
			return sanitizeForClone(value) as T;
		}
		throw _err;
	}
}
