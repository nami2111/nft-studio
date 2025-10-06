/**
 * Trait filtering functionality for layer items
 * Handles search and filtering of traits within a layer
 */

import type { Layer } from '$lib/types/layer';

export class TraitFilter {
	private searchTerm = '';

	/**
	 * Get current search term
	 */
	get term(): string {
		return this.searchTerm;
	}

	/**
	 * Set search term
	 */
	set term(value: string) {
		this.searchTerm = value;
	}

	/**
	 * Filter traits based on search term
	 */
	filterTraits(layer: Layer[]): Layer[] {
		if (!this.searchTerm.trim()) {
			return layer;
		}

		const term = this.searchTerm.toLowerCase();
		return layer.filter((trait) => trait.name.toLowerCase().includes(term));
	}

	/**
	 * Clear search term
	 */
	clear(): void {
		this.searchTerm = '';
	}

	/**
	 * Check if filter is active
	 */
	get isActive(): boolean {
		return this.searchTerm.trim().length > 0;
	}

	/**
	 * Get count of filtered traits
	 */
	getFilteredCount(layer: Layer[]): number {
		return this.filterTraits(layer).length;
	}
}
