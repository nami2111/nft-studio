/**
 * Loading state management for the application
 * Provides centralized management of loading states and progress tracking
 */

export interface LoadingState {
	progress: number;
	total: number;
	message: string;
	status: 'idle' | 'loading' | 'success' | 'error';
}

export class LoadingStateManager {
	private loadingStates: Record<string, boolean> = {};
	private detailedLoadingStates: Record<string, LoadingState> = {};
	private listeners: Set<() => void> = new Set();

	/**
	 * Start a simple loading operation
	 */
	startLoading(operation: string): void {
		this.loadingStates[operation] = true;
		this.notifyListeners();
	}

	/**
	 * Stop a simple loading operation
	 */
	stopLoading(operation: string): void {
		this.loadingStates[operation] = false;
		this.notifyListeners();
	}

	/**
	 * Notify all listeners of state changes
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => listener());
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Check if an operation is loading
	 */
	getLoadingState(operation: string): boolean {
		return this.loadingStates[operation] || false;
	}

	/**
	 * Start a detailed loading operation with progress tracking
	 */
	startDetailedLoading(operation: string, total: number = 100): void {
		this.detailedLoadingStates[operation] = {
			progress: 0,
			total,
			message: 'Starting...',
			status: 'loading'
		};
	}

	/**
	 * Update progress for a detailed loading operation
	 */
	updateDetailedLoading(operation: string, progress: number, message?: string): void {
		const state = this.detailedLoadingStates[operation];
		if (state) {
			state.progress = progress;
			if (message) {
				state.message = message;
			}
		}
	}

	/**
	 * Stop a detailed loading operation
	 */
	stopDetailedLoading(operation: string, success: boolean = true): void {
		const state = this.detailedLoadingStates[operation];
		if (state) {
			state.status = success ? 'success' : 'error';
			state.progress = state.total;
		}
	}

	/**
	 * Get detailed loading state for an operation
	 */
	getDetailedLoadingState(operation: string): LoadingState | undefined {
		return this.detailedLoadingStates[operation];
	}

	/**
	 * Clear all loading states
	 */
	clearAllStates(): void {
		this.loadingStates = {};
		this.detailedLoadingStates = {};
	}

	/**
	 * Get all active loading operations
	 */
	getActiveOperations(): string[] {
		return Object.keys(this.loadingStates).filter((key) => this.loadingStates[key]);
	}

	/**
	 * Check if any operation is currently loading
	 */
	hasActiveOperations(): boolean {
		return this.getActiveOperations().length > 0;
	}

	/**
	 * Get all loading states
	 */
	getAllLoadingStates(): Record<string, boolean> {
		return { ...this.loadingStates };
	}

	/**
	 * Get all detailed loading states
	 */
	getAllDetailedStates(): Record<string, LoadingState> {
		return { ...this.detailedLoadingStates };
	}
}

// Singleton instance for global loading state management
export const loadingStateManager = new LoadingStateManager();
