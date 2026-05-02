// Lightweight logging utility to standardize logs across the codebase
export const logger = {
	info: (...args: unknown[]) => console.info('[gnstudio]', ...args),
	warn: (...args: unknown[]) => console.warn('[gnstudio]', ...args),
	error: (...args: unknown[]) => console.error('[gnstudio]', ...args),
	debug: (...args: unknown[]) => console.debug('[gnstudio]', ...args)
};

export default logger;
