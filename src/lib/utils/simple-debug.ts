/**
 * Simple debug utility for gallery performance monitoring
 */

export function debugLog(message: string, ...args: any[]) {
	if (import.meta.env.DEV) {
		console.log('🔍 [GALLERY DEBUG]', message, ...args);
	}
}

export function debugTime(label: string) {
	const start = performance.now();
	return () => {
		const end = performance.now();
		debugLog(`⏱️ END ${label}: ${(end - start).toFixed(2)}ms`);
	};
}

export function debugGroup(label: string) {
	if (import.meta.env.DEV) {
		console.group('🔍 [GALLERY DEBUG]', label);
	}
}

export function debugGroupEnd() {
	if (import.meta.env.DEV) {
		console.groupEnd();
	}
}

let debugCounter = 0;

export function debugCount(label?: string, count?: number) {
	debugCounter++;
	if (import.meta.env.DEV) {
		const displayCount = count !== undefined ? count : debugCounter;
		console.log(`🔢 [GALLERY DEBUG] ${label || 'Count'}: ${displayCount}`);
	}
	return debugCounter;
}