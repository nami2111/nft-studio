// Lightweight logging utility to standardize logs across the codebase
export const logger = {
	info: (...args: unknown[]) => {
		if (import.meta.env.DEV) console.info("[gnstudio]", ...args);
	},
	warn: (...args: unknown[]) => console.warn("[gnstudio]", ...args),
	error: (...args: unknown[]) => console.error("[gnstudio]", ...args),
	debug: (...args: unknown[]) => {
		if (import.meta.env.DEV) console.debug("[gnstudio]", ...args);
	},
};

export default logger;
