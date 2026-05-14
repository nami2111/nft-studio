/**
 * Generation worker client — thin re-export of the orchestrator.
 *
 * Kept for backward compatibility with existing imports
 * (e.g., generation-worker-client.test.ts).
 */

export {
	solveOnMainThread,
	runGeneration,
	cancelGeneration,
	type GenerationCallbacks,
	type GenerationConfig
} from './generation.orchestrator';

/**
 * @deprecated Use runGeneration (from orchestrator) with GenerationCallbacks instead.
 */
export { runGeneration as startGeneration } from './generation.orchestrator';
