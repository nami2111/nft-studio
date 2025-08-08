// Lightweight logging utility to standardize logs across the codebase
export const logger = {
	info: (...args: any[]) => console.info('[nft-studio]', ...args),
	warn: (...args: any[]) => console.warn('[nft-studio]', ...args),
	error: (...args: any[]) => console.error('[nft-studio]', ...args),
	debug: (...args: any[]) => console.debug('[nft-studio]', ...args)
};

export default logger;
