// Lightweight logging utility to standardize logs across the codebase
export const logger = {
	info: (...args: unknown[]) => console.info('[nft-studio]', ...args),
	warn: (...args: unknown[]) => console.warn('[nft-studio]', ...args),
	error: (...args: unknown[]) => console.error('[nft-studio]', ...args),
	debug: (...args: unknown[]) => console.debug('[nft-studio]', ...args)
};

export default logger;
