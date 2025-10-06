/**
 * Trait selection logic for preview component
 * Manages selected trait IDs and provides utility functions
 */

import type { Layer } from '$lib/types/layer';
import type { TraitId } from '$lib/types/ids';

export class TraitSelector {
	private selectedTraitIds: (TraitId | '')[] = [];

	/**
	 * Initialize with project layers
	 */
	initialize(layers: Layer[]): void {
		const newSelectedTraits = layers.map((layer) =>
			layer.traits.length > 0 ? layer.traits[0].id : ''
		);
		this.selectedTraitIds = newSelectedTraits;
	}

	/**
	 * Get currently selected trait IDs
	 */
	get selections(): (TraitId | '')[] {
		return this.selectedTraitIds;
	}

	/**
	 * Update selected trait for a specific layer
	 */
	setSelection(layerIndex: number, traitId: TraitId | ''): void {
		if (layerIndex >= 0 && layerIndex < this.selectedTraitIds.length) {
			this.selectedTraitIds[layerIndex] = traitId;
		}
	}

	/**
	 * Get selected trait ID for a specific layer
	 */
	getSelection(layerIndex: number): TraitId | '' {
		return this.selectedTraitIds[layerIndex] || '';
	}

	/**
	 * Update selections when layers change
	 */
	updateForLayers(layers: Layer[]): void {
		const newSelectedTraits: (TraitId | '')[] = [];

		for (let i = 0; i < layers.length; i++) {
			const layer = layers[i];
			const currentSelectedId = this.selectedTraitIds[i];

			// If current selection exists in new layer, keep it, otherwise use first trait
			if (layer.traits.length > 0) {
				const traitExists = layer.traits.some((trait) => trait.id === currentSelectedId);
				if (traitExists) {
					newSelectedTraits.push(currentSelectedId);
				} else {
					newSelectedTraits.push(layer.traits[0].id);
				}
			} else {
				newSelectedTraits.push('');
			}
		}

		// Only update if there's actually a change to prevent infinite loops
		if (JSON.stringify(newSelectedTraits) !== JSON.stringify(this.selectedTraitIds)) {
			this.selectedTraitIds = newSelectedTraits;
		}
	}

	/**
	 * Randomize all trait selections
	 */
	randomize(layers: Layer[]): void {
		const newSelectedTraits: (TraitId | '')[] = [];

		for (const layer of layers) {
			if (layer.traits.length > 0) {
				const randomIndex = Math.floor(Math.random() * layer.traits.length);
				newSelectedTraits.push(layer.traits[randomIndex].id);
			} else {
				newSelectedTraits.push('');
			}
		}

		this.selectedTraitIds = newSelectedTraits;
	}

	/**
	 * Get selected trait objects for all layers
	 */
	getSelectedTraits(layers: Layer[]): (Layer['traits'][number] | null)[] {
		return layers.map((layer, i) => {
			const selectedId = this.selectedTraitIds[i];
			if (!selectedId) return null;
			return layer.traits.find((trait) => trait.id === selectedId) || null;
		});
	}

	/**
	 * Check if all layers have valid selections
	 */
	hasCompleteSelections(layers: Layer[]): boolean {
		return layers.every((layer, i) => {
			if (layer.traits.length === 0) return true; // Empty layer is OK
			return this.selectedTraitIds[i] !== '';
		});
	}

	/**
	 * Reset to first trait of each layer
	 */
	reset(layers: Layer[]): void {
		const newSelectedTraits = layers.map((layer) =>
			layer.traits.length > 0 ? layer.traits[0].id : ''
		);
		this.selectedTraitIds = newSelectedTraits;
	}
}
