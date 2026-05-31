/**
 * Route-scoped Resource Manager Context
 * Provides automatic cleanup when route unmounts using Svelte context.
 */

import { getContext, setContext, onDestroy } from 'svelte';
import { ResourceManager, type CacheConfig } from './resource-manager';

const RESOURCE_MANAGER_KEY = Symbol('resource-manager');

// WeakMap tracks instances for auto-cleanup verification
const instanceRegistry = new WeakMap<ResourceManager, { route: string; created: number }>();

/**
 * Create and set a route-scoped ResourceManager in Svelte context.
 * Call this in route +layout.svelte files.
 * Manager automatically cleans up when route unmounts.
 */
export function createResourceManagerContext(
	routeName: string,
	config?: CacheConfig
): ResourceManager {
	const manager = new ResourceManager(config);
	instanceRegistry.set(manager, { route: routeName, created: Date.now() });

	setContext(RESOURCE_MANAGER_KEY, manager);

	// Auto-cleanup on route unmount
	onDestroy(() => {
		manager.destroy();
		instanceRegistry.delete(manager);
	});

	return manager;
}

/**
 * Get the ResourceManager from Svelte context.
 * Throws if called outside a route with createResourceManagerContext.
 */
export function useResourceManager(): ResourceManager {
	const manager = getContext<ResourceManager>(RESOURCE_MANAGER_KEY);
	if (!manager) {
		throw new Error(
			'ResourceManager not found in context. Call createResourceManagerContext in route +layout.svelte'
		);
	}
	return manager;
}

/**
 * Get ResourceManager from context if available, otherwise return global.
 * Use this for components that work both in routes and standalone.
 */
export function useResourceManagerOrGlobal(globalManager: ResourceManager): ResourceManager {
	try {
		return useResourceManager();
	} catch {
		return globalManager;
	}
}
