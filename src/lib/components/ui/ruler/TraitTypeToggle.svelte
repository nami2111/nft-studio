<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Icon from '$components/shared/Icon.svelte';
	import { Crown03Icon } from '@hugeicons/core-free-icons';
	import type { Trait, TraitType } from '$lib/types/layer';

	import { createLayerId, createTraitId } from '$lib/types/ids';

	import { project } from '$lib/stores';
	import { toast } from 'svelte-sonner';

	interface Props {
		trait: Trait;
		layerId: string;
		class?: string;
	}

	const { trait, layerId, class: className = '' }: Props = $props();

	const layerIdTyped = $derived(createLayerId(layerId));
	const traitIdTyped = $derived(createTraitId(trait.id));

	// Get current layer
	const currentLayer = $derived(project.layers.find((l) => l.id === layerIdTyped));

	// Toggle trait type
	function toggleTraitType() {
		if (!currentLayer) return;

		const traitIndex = currentLayer.traits.findIndex((t) => t.id === traitIdTyped);
		if (traitIndex === -1) return;

		const currentType = currentLayer.traits[traitIndex].type || 'normal';
		const newType: TraitType = currentType === 'normal' ? 'ruler' : 'normal';

		// Update trait type
		currentLayer.traits[traitIndex].type = newType;

		// Initialize ruler rules if becoming ruler
		if (newType === 'ruler' && !currentLayer.traits[traitIndex].rulerRules) {
			currentLayer.traits[traitIndex].rulerRules = [];
		}

		// Clear ruler rules if becoming normal
		if (newType === 'normal') {
			currentLayer.traits[traitIndex].rulerRules = undefined;
		}

		const action = newType === 'ruler' ? 'promoted to' : 'demoted from';
		toast.success(`"${trait.name}" ${action} ruler trait.`);
	}
</script>

{#if currentLayer}
	<Button
		variant="ghost"
		size="icon"
		title={trait.type === 'ruler' ? 'Demote from ruler' : 'Promote to ruler'}
		onclick={toggleTraitType}
		class="{trait.type === 'ruler' ? 'text-foreground' : ''} {className}"
		data-testid="trait-type-toggle"
		data-trait-type={trait.type || 'normal'}
	>
		<Icon icon={Crown03Icon} class="h-4 w-4" />
	</Button>
{/if}
