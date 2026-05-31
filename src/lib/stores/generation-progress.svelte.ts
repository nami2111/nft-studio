/**
 * Minimal Generation State Store
 *
 * Tracks generation lifecycle and progress. The orchestrator
 * (generation.orchestrator.ts) drives state mutations; the form
 * and UI components read state reactively via Svelte 5 runes.
 *
 * @note Module-level singleton — generation is a single-session SPA.
 */

import type { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import type { Layer, StrictPairConfig } from '$lib/types/layer';
import type { ErrorMessage, ProgressMessage } from '$lib/types/worker-messages';

export interface StartGenerationConfig {
	projectName: string;
	projectDescription: string;
	outputSize: { width: number; height: number };
	layers: Layer[];
	collectionSize: number;
	strictPairConfig?: StrictPairConfig;
	metadataStandard?: MetadataStandard;
}

// ─── State Type ───────────────────────────────────────────────
export interface GenerationState {
	isGenerating: boolean;
	isPaused: boolean;
	isBackground: boolean;

	currentIndex: number;
	totalItems: number;
	progress: number; // 0–100
	statusText: string;

	startTime: number | null;
	completionTime: number | null;

	previews: { index: number; url: string }[];

	error: string | null;
	sessionId: string | null;

	// Worker-reported memory usage
	memoryUsage: number | { used: number; available: number; units: string } | null;

	// Live performance metrics (computed from progress messages)
	itemsPerSecond: number | null;
	eta: number | null;
	batchProgress: { current: number; total: number } | null;
}

// ─── Default State ────────────────────────────────────────────
const DEFAULT_STATE: GenerationState = {
	isGenerating: false,
	isPaused: false,
	isBackground: false,
	currentIndex: 0,
	totalItems: 0,
	progress: 0,
	statusText: 'Ready to generate',
	startTime: null,
	completionTime: null,
	previews: [],
	error: null,
	sessionId: null,
	memoryUsage: null,
	itemsPerSecond: null,
	eta: null,
	batchProgress: null
};

function freshState(): GenerationState {
	return { ...DEFAULT_STATE, previews: [] };
}

// ─── Reactive Singleton ───────────────────────────────────────
export const generationState = $state<GenerationState>(freshState());

// ─── Lifecycle ────────────────────────────────────────────────

export function startGeneration(config: StartGenerationConfig): string {
	const sessionId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	Object.assign(generationState, freshState(), {
		isGenerating: true,
		totalItems: config.collectionSize,
		sessionId,
		startTime: Date.now(),
		statusText: 'Starting generation...'
	});

	return sessionId;
}

export function pauseGeneration(reason?: string): void {
	if (!generationState.isGenerating) return;
	generationState.isPaused = true;
	generationState.isBackground = true;
	generationState.statusText = reason || 'Generation paused';
}

export function completeGeneration(): void {
	if (!generationState.isGenerating) return;
	generationState.isGenerating = false;
	generationState.isPaused = false;
	generationState.isBackground = false;
	generationState.progress = 100;
	generationState.completionTime = Date.now();
	generationState.statusText = 'Generation completed';
}

export function cancelGeneration(): void {
	if (!generationState.isGenerating) return;
	resetState();
}

// ─── Progress Updates ─────────────────────────────────────────

export function updateProgress(data: ProgressMessage): void {
	if (!generationState.isGenerating) return;

	const { generatedCount, totalCount, statusText, memoryUsage } = data.payload;
	const progress = totalCount > 0 ? (generatedCount / totalCount) * 100 : 0;

	generationState.currentIndex = generatedCount;
	generationState.totalItems = totalCount;
	generationState.progress = Math.min(100, Math.max(0, progress));
	generationState.statusText = statusText;

	if (memoryUsage) {
		generationState.memoryUsage = memoryUsage;
	}

	// Compute performance metrics
	const now = Date.now();
	if (generationState.startTime) {
		const elapsedSeconds = (now - generationState.startTime) / 1000;
		if (elapsedSeconds > 1 && generatedCount > 0) {
			generationState.itemsPerSecond = generatedCount / elapsedSeconds;
			const remaining = totalCount - generatedCount;
			generationState.eta = remaining > 0 ? remaining / generationState.itemsPerSecond : 0;
		}
	}

	// Track batch progress from batch-processing status text
	if (statusText.startsWith('Batch processing:')) {
		const m = statusText.match(/Batch processing: (\d+)\/(\d+)/);
		if (m) {
			generationState.batchProgress = { current: parseInt(m[1]), total: parseInt(m[2]) };
		}
	}
}

export function addPreviews(previews: { index: number; url: string }[]): void {
	if (!generationState.isGenerating) return;
	generationState.previews.push(...previews);
}

export function handleError(msg: ErrorMessage): void {
	generationState.error = msg.payload.message;
	generationState.isGenerating = false;
	generationState.isPaused = false;
}

// ─── Reset ────────────────────────────────────────────────────

export function resetState(): void {
	// Revoke preview ObjectURLs
	for (const p of generationState.previews) {
		try {
			URL.revokeObjectURL(p.url);
		} catch {
			/* ignore */
		}
	}

	Object.assign(generationState, freshState());
}

/**
 * Clean up generation state and release resources.
 * Call when app unmounts or user explicitly clears state.
 */
export function cleanupGenerationState(): void {
	resetState();
}
