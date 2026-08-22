// Lightweight logging utility to standardize logs across the codebase
export const logger = {
	info: (...args: unknown[]) => {
		if (import.meta.env.DEV) console.info('[gnstudio]', ...args);
	},
	warn: (...args: unknown[]) => console.warn('[gnstudio]', ...args),
	error: (...args: unknown[]) => console.error('[gnstudio]', ...args),
	debug: (...args: unknown[]) => {
		if (import.meta.env.DEV) console.debug('[gnstudio]', ...args);
	}
};

export default logger;

// Dev-only debug helpers (gallery perf tracing)

export function debugLog(message: string, ...args: unknown[]): void {
	if (import.meta.env.DEV) {
		console.log('🎨', message, ...args);
	}
}

/** Start a timer; call the returned function to log the elapsed time. */
export function debugTime(label: string): () => void {
	const start = performance.now();
	return () => {
		debugLog(`⏱️ ${label}: ${(performance.now() - start).toFixed(2)}ms`);
	};
}

let debugCounter = 0;

/** Log a labelled count; defaults to an auto-incrementing counter. */
export function debugCount(label?: string, count?: number): number {
	debugCounter++;
	if (import.meta.env.DEV) {
		console.log(`🔢 ${label || 'Count'}: ${count !== undefined ? count : debugCounter}`);
	}
	return debugCounter;
}
