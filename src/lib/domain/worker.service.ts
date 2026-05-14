/**
 * Domain-facing generation service — thin re-export of the orchestrator.
 *
 * The orchestrator (src/lib/workers/generation.orchestrator.ts) handles
 * the full pipeline: layer prep → CSP → batch dispatch → ZIP streaming.
 */

export {
	runGeneration,
	cancelGeneration,
	type GenerationCallbacks,
	type GenerationConfig
} from '$lib/workers/generation.orchestrator';
