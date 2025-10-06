/**
 * Bulk operations for traits in a layer
 * Handles selection, bulk editing, and bulk deletion
 */

import { SvelteSet } from 'svelte/reactivity';
import type { Layer } from '$lib/types/layer';
import type { LayerId, TraitId } from '$lib/types/ids';
import { createTraitId } from '$lib/types/ids';
import { toast } from 'svelte-sonner';
import { removeTrait, updateTraitRarity, updateTraitName } from '$lib/stores';

export class TraitBulkOperations {
	private selectedTraits = new SvelteSet<TraitId>();
	private bulkRarityWeight = 3;
	private bulkNewName = '';

	/**
	 * Get currently selected trait IDs
	 */
	get selections(): SvelteSet<TraitId> {
		return this.selectedTraits;
	}

	/**
	 * Get bulk rarity weight
	 */
	get rarityWeight(): number {
		return this.bulkRarityWeight;
	}

	/**
	 * Set bulk rarity weight
	 */
	set rarityWeight(value: number) {
		this.bulkRarityWeight = value;
	}

	/**
	 * Get bulk new name
	 */
	get newName(): string {
		return this.bulkNewName;
	}

	/**
	 * Set bulk new name
	 */
	set newName(value: string) {
		this.bulkNewName = value;
	}

	/**
	 * Check if any traits are selected
	 */
	get hasSelections(): boolean {
		return this.selectedTraits.size > 0;
	}

	/**
	 * Get count of selected traits
	 */
	get selectionCount(): number {
		return this.selectedTraits.size;
	}

	/**
	 * Toggle trait selection
	 */
	toggleSelection(traitId: TraitId): void {
		if (this.selectedTraits.has(traitId)) {
			this.selectedTraits.delete(traitId);
		} else {
			this.selectedTraits.add(traitId);
		}
	}

	/**
	 * Select all traits in filtered list
	 */
	selectAllFiltered(filteredTraits: { id: string }[]): void {
		filteredTraits.forEach((trait) => {
			const traitId = createTraitId(trait.id);
			this.selectedTraits.add(traitId);
		});
	}

	/**
	 * Clear all selections
	 */
	clearSelection(): void {
		this.selectedTraits.clear();
	}

	/**
	 * Check if a trait is selected
	 */
	isSelected(traitId: TraitId): boolean {
		return this.selectedTraits.has(traitId);
	}

	/**
	 * Bulk delete selected traits
	 */
	bulkDelete(layerId: LayerId): void {
		if (this.selectedTraits.size === 0) return;

		// Show confirmation dialog
		toast.warning(`Are you sure you want to delete ${this.selectedTraits.size} trait(s)?`, {
			action: {
				label: 'Delete',
				onClick: () => {
					// Delete all selected traits
					this.selectedTraits.forEach((traitId) => {
						removeTrait(layerId, traitId);
					});
					toast.success(`${this.selectedTraits.size} trait(s) deleted successfully.`);
					this.clearSelection();
				}
			},
			cancel: {
				label: 'Cancel',
				onClick: () => {}
			}
		});
	}

	/**
	 * Bulk update rarity for selected traits
	 */
	bulkUpdateRarity(layerId: LayerId): void {
		if (this.selectedTraits.size === 0) return;

		this.selectedTraits.forEach((traitId) => {
			updateTraitRarity(layerId, traitId, this.bulkRarityWeight);
		});
		toast.success(`Updated rarity for ${this.selectedTraits.size} trait(s).`);
	}

	/**
	 * Bulk rename selected traits
	 */
	bulkRename(layer: Layer): void {
		if (this.selectedTraits.size === 0) return;

		let count = 0;
		this.selectedTraits.forEach((traitId) => {
			const trait = layer.traits.find((t) => t.id === traitId);
			if (trait) {
				const newName = `${this.bulkNewName}_${count + 1}`;
				updateTraitName(layer.id, traitId, newName);
				count++;
			}
		});
		toast.success(`Renamed ${count} trait(s).`);
		this.clearSelection();
	}
}
