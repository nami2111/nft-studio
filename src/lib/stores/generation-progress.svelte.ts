/**
 * Persistent Generation State Store
 * Manages generation state that survives component unmounts and preserves generation logic integrity
 * Including strict pair tracking, rarity distribution, and progress
 */

import type { Layer, StrictPairConfig } from '$lib/types/layer';
import type { ProgressMessage, CompleteMessage, ErrorMessage, CancelledMessage, PreviewMessage } from '$lib/types/worker-messages';

// Generation state interface
export interface GenerationState {
	// Core generation status
	isGenerating: boolean;
	isPaused: boolean;
	isBackground: boolean;

	// Progress tracking
	currentIndex: number;
	totalItems: number;
	progress: number; // 0-100
	statusText: string;

	// Timing and analytics
	startTime: number | null;
	lastUpdate: number | null;
	completionTime: number | null;

	// Data accumulation (persistent)
	allImages: { name: string; imageData: ArrayBuffer }[];
	allMetadata: { name: string; data: Record<string, unknown> }[];
	previews: { index: number; url: string }[];

	// Critical generation logic state
	usedCombinations: Map<string, Set<string>>; // Strict pair tracking
	strictPairConfig: StrictPairConfig | null;
	projectConfig: {
		name: string;
		description: string;
		outputSize: { width: number; height: number };
		layers: Layer[];
	} | null;

	// Memory and performance
	memoryUsage: { used: number; available: number; units: string } | null;
	lastMemoryCheck: number | null;

	// Error handling
	error: string | null;
	warnings: string[];

	// Session management
	sessionId: string | null;
	saveTimestamp: number | null;
}

// Default state
const defaultState: GenerationState = {
	isGenerating: false,
	isPaused: false,
	isBackground: false,
	currentIndex: 0,
	totalItems: 0,
	progress: 0,
	statusText: 'Ready to generate',
	startTime: null,
	lastUpdate: null,
	completionTime: null,
	allImages: [],
	allMetadata: [],
	previews: [],
	usedCombinations: new Map(),
	strictPairConfig: null,
	projectConfig: null,
	memoryUsage: null,
	lastMemoryCheck: null,
	error: null,
	warnings: [],
	sessionId: null,
	saveTimestamp: null
};

// Persistent generation state using Svelte 5 runes
export const generationState = $state<GenerationState>(structuredClone(defaultState));

// Store management functions
class GenerationStateManager {
	private readonly STORAGE_KEY = 'nft-studio-generation-state';
	private readonly STATE_VERSION = '1.0.0';
	private saveTimeout: number | null = null;
	private autoSaveEnabled = true;
	private maxRetries = 3;
	private retryDelay = 1000; // 1 second

	/**
	 * Initialize the generation state manager
	 */
	initialize(): void {
		// Load any saved state from sessionStorage
		this.loadSavedState();

		// Set up periodic auto-save
		this.setupAutoSave();

		// Clean up old partial states on initialization
		this.cleanupOldStates();
	}

	/**
	 * Start a new generation session
	 */
	startGeneration(config: {
		projectName: string;
		projectDescription: string;
		outputSize: { width: number; height: number };
		layers: Layer[];
		collectionSize: number;
		strictPairConfig?: StrictPairConfig;
	}): string {
		const sessionId = this.generateSessionId();

		// Reset state with new configuration
		Object.assign(generationState, defaultState, {
			isGenerating: true,
			isPaused: false,
			isBackground: false,
			totalItems: config.collectionSize,
			projectConfig: {
				name: config.projectName,
				description: config.projectDescription,
				outputSize: config.outputSize,
				layers: config.layers
			},
			strictPairConfig: config.strictPairConfig || null,
			sessionId,
			startTime: Date.now(),
			lastUpdate: Date.now(),
			statusText: 'Starting generation...'
		});

		// Save initial state
		this.saveState();

		console.log(`🎯 Generation started: ${sessionId} (${config.collectionSize} items)`);
		return sessionId;
	}

	/**
	 * Pause the current generation (saves state for resuming)
	 */
	pauseGeneration(reason?: string): void {
		if (!generationState.isGenerating) return;

		generationState.isPaused = true;
		generationState.isBackground = true;
		generationState.statusText = reason || 'Generation paused';
		generationState.saveTimestamp = Date.now();

		// Save state for resuming
		this.savePartialState(reason);

		console.log(`⏸️ Generation paused: ${generationState.sessionId}`);
	}

	
	/**
	 * Complete the current generation
	 */
	completeGeneration(): void {
		if (!generationState.isGenerating) return;

		generationState.isGenerating = false;
		generationState.isPaused = false;
		generationState.isBackground = false;
		generationState.progress = 100;
		generationState.completionTime = Date.now();
		generationState.lastUpdate = Date.now();
		generationState.statusText = 'Generation completed';

		// Save final state
		this.saveState();

		// Clear partial state if it exists
		sessionStorage.removeItem(this.STORAGE_KEY_PARTIAL);

		console.log(`✅ Generation completed: ${generationState.sessionId}`);
	}

	/**
	 * Cancel the current generation and clean up all resources
	 */
	cancelGeneration(): void {
		if (!generationState.isGenerating) return;

		const sessionId = generationState.sessionId;

		// Reset state completely
		this.resetState();

		console.log(`🛑 Generation cancelled: ${sessionId}`);
	}

	/**
	 * Update generation progress
	 */
	updateProgress(data: ProgressMessage): void {
		if (!generationState.isGenerating) return;

		const { generatedCount, totalCount, statusText, memoryUsage } = data.payload;

		// Calculate progress percentage safely
		const progress = totalCount > 0 ? (generatedCount / totalCount) * 100 : 0;

		// Update state
		generationState.currentIndex = generatedCount;
		generationState.totalItems = totalCount;
		generationState.progress = Math.min(100, Math.max(0, progress));
		generationState.statusText = statusText;
		generationState.lastUpdate = Date.now();

		// Update memory usage if provided
		if (memoryUsage) {
			generationState.memoryUsage = memoryUsage;
			generationState.lastMemoryCheck = Date.now();
		}

		// Auto-save progress
		this.scheduleAutoSave();
	}

	/**
	 * Add generated images to state
	 */
	addImages(images: { name: string; imageData: ArrayBuffer }[]): void {
		if (!generationState.isGenerating) return;

		generationState.allImages.push(...images);
		generationState.lastUpdate = Date.now();

		// Check memory usage
		this.checkMemoryUsage();
	}

	/**
	 * Add generated metadata to state
	 */
	addMetadata(metadata: { name: string; data: Record<string, unknown> }[]): void {
		if (!generationState.isGenerating) return;

		generationState.allMetadata.push(...metadata);
		generationState.lastUpdate = Date.now();
	}

	/**
	 * Add preview URLs
	 */
	addPreviews(previews: { index: number; url: string }[]): void {
		if (!generationState.isGenerating) return;

		generationState.previews.push(...previews);
		generationState.lastUpdate = Date.now();
	}

	/**
	 * Add strict pair combination to used combinations
	 */
	addUsedCombination(combinationId: string, traitIds: string[]): void {
		if (!generationState.usedCombinations.has(combinationId)) {
			generationState.usedCombinations.set(combinationId, new Set());
		}
		const combination = generationState.usedCombinations.get(combinationId)!;
		const key = traitIds.sort().join('|');
		combination.add(key);
		generationState.lastUpdate = Date.now();
	}

	/**
	 * Check if a trait combination is already used
	 */
	isCombinationUsed(combinationId: string, traitIds: string[]): boolean {
		const combination = generationState.usedCombinations.get(combinationId);
		if (!combination) return false;

		const key = traitIds.sort().join('|');
		return combination.has(key);
	}

	/**
	 * Handle generation errors
	 */
	handleError(error: ErrorMessage): void {
		generationState.error = error.payload.message;
		generationState.isGenerating = false;
		generationState.isPaused = false;
		generationState.lastUpdate = Date.now();

		console.error(`❌ Generation error in ${generationState.sessionId}:`, error.payload.message);
	}

	/**
	 * Add warning message
	 */
	addWarning(warning: string): void {
		generationState.warnings.push(warning);
		generationState.lastUpdate = Date.now();

		// Keep only last 10 warnings
		if (generationState.warnings.length > 10) {
			generationState.warnings = generationState.warnings.slice(-10);
		}
	}

	/**
	 * Reset generation state to defaults
	 */
	resetState(): void {
		// Clean up any resources before reset
		this.cleanupResources();

		// Reset to default state
		Object.assign(generationState, structuredClone(defaultState));

		// Clear saved state
		sessionStorage.removeItem(this.STORAGE_KEY);
	}

	/**
	 * Get current memory usage estimate
	 */
	getMemoryUsage(): number {
		// Calculate memory usage from accumulated data
		let totalBytes = 0;

		// Images memory
		totalBytes += generationState.allImages.reduce((sum, img) => sum + img.imageData.byteLength, 0);

		// Metadata memory (rough estimate)
		totalBytes += generationState.allMetadata.reduce((sum, meta) => sum + JSON.stringify(meta.data).length * 2, 0);

		// Used combinations memory (rough estimate)
		let combinationCount = 0;
		for (const set of generationState.usedCombinations.values()) {
			combinationCount += set.size;
		}
		totalBytes += combinationCount * 100; // ~100 bytes per combination

		return totalBytes;
	}

	/**
	 * Check memory usage and add warnings if needed
	 */
	private checkMemoryUsage(): void {
		const currentUsage = this.getMemoryUsage();
		const maxUsage = 500 * 1024 * 1024; // 500MB limit

		if (currentUsage > maxUsage) {
			this.addWarning(`Memory usage high: ${Math.round(currentUsage / 1024 / 1024)}MB. Consider smaller collection sizes.`);
		}
	}

	/**
	 * Clean up resources (ObjectURLs, etc.)
	 */
	private cleanupResources(): void {
		// Revoke all preview ObjectURLs
		generationState.previews.forEach(preview => {
			try {
				URL.revokeObjectURL(preview.url);
			} catch (error) {
				console.warn('Failed to revoke ObjectURL:', error);
			}
		});
	}

	/**
	 * Generate a unique session ID
	 */
	private generateSessionId(): string {
		return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Save state to sessionStorage
	 */
	private saveState(): void {
		try {
			const stateData = {
				version: this.STATE_VERSION,
				timestamp: Date.now(),
				state: this.serializeState()
			};

			sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateData));
		} catch (error) {
			console.error('Failed to save generation state:', error);
		}
	}

	
	/**
	 * Load saved state from sessionStorage
	 */
	private loadSavedState(): void {
		try {
			const savedData = sessionStorage.getItem(this.STORAGE_KEY);
			if (savedData) {
				const data = JSON.parse(savedData);
				if (data.version === this.STATE_VERSION) {
					this.restoreState(data.state);
					console.log('📂 Generation state restored from session');
				}
			}
		} catch (error) {
			console.warn('Failed to load saved generation state:', error);
		}
	}

	
	/**
	 * Serialize state for storage
	 */
	private serializeState(): any {
		return {
			...generationState,
			usedCombinations: Array.from(generationState.usedCombinations.entries()),
			// Convert Map to array for serialization
		};
	}

	/**
	 * Restore state from serialized data
	 */
	private restoreState(serializedState: any): void {
		// Convert arrays back to Maps
		if (serializedState.usedCombinations) {
			serializedState.usedCombinations = new Map(
				serializedState.usedCombinations.map(([key, value]: [string, string[]]) => [key, new Set(value)])
			);
		}

		// Restore state
		Object.assign(generationState, serializedState);
	}

	/**
	 * Set up periodic auto-save
	 */
	private setupAutoSave(): void {
		// Save state every 30 seconds during generation
		setInterval(() => {
			if (generationState.isGenerating && !generationState.isPaused) {
				this.saveState();
			}
		}, 30000);
	}

	/**
	 * Schedule auto-save with debouncing
	 */
	private scheduleAutoSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		this.saveTimeout = setTimeout(() => {
			if (generationState.isGenerating) {
				this.saveState();
			}
		}, 2000); // 2 second debounce
	}

	
	/**
	 * Get human-readable memory usage
	 */
	getMemorySummary(): string {
		const bytes = this.getMemoryUsage();
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	
	/**
	 * Get summary of current generation state
	 */
	getSummary(): {
		sessionId: string | null;
		isGenerating: boolean;
		isPaused: boolean;
		progress: number;
		statusText: string;
		memoryUsage: string;
		itemsGenerated: number;
		totalItems: number;
	} {
		return {
			sessionId: generationState.sessionId,
			isGenerating: generationState.isGenerating,
			isPaused: generationState.isPaused,
			progress: generationState.progress,
			statusText: generationState.statusText,
			memoryUsage: this.getMemorySummary(),
			itemsGenerated: generationState.currentIndex,
			totalItems: generationState.totalItems
		};
	}
}

// Create singleton instance
export const generationStateManager = new GenerationStateManager();

// Initialize on import
generationStateManager.initialize();

// Export convenience functions
export const startGeneration = generationStateManager.startGeneration.bind(generationStateManager);
export const pauseGeneration = generationStateManager.pauseGeneration.bind(generationStateManager);
export const completeGeneration = generationStateManager.completeGeneration.bind(generationStateManager);
export const cancelGeneration = generationStateManager.cancelGeneration.bind(generationStateManager);
export const updateProgress = generationStateManager.updateProgress.bind(generationStateManager);
export const addImages = generationStateManager.addImages.bind(generationStateManager);
export const addMetadata = generationStateManager.addImages.bind(generationStateManager);
export const addPreviews = generationStateManager.addPreviews.bind(generationStateManager);
export const addUsedCombination = generationStateManager.addUsedCombination.bind(generationStateManager);
export const isCombinationUsed = generationStateManager.isCombinationUsed.bind(generationStateManager);
export const handleError = generationStateManager.handleError.bind(generationStateManager);
export const addWarning = generationStateManager.addWarning.bind(generationStateManager);
export const resetState = generationStateManager.resetState.bind(generationStateManager);
export const getMemorySummary = generationStateManager.getMemorySummary.bind(generationStateManager);
export const getSummary = generationStateManager.getSummary.bind(generationStateManager);