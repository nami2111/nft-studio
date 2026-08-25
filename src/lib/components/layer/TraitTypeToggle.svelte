<script lang="ts">
	import { Button, flatIconButtonClass } from '$lib/components/ui/button';
	import Icon from '$components/shared/Icon.svelte';
	import { Crown03Icon } from '@hugeicons/core-free-icons';
	import type { Trait, TraitType } from '$lib/types/layer';

	import { createLayerId, createTraitId } from '$lib/types/ids';

	import { project, toggleTraitType as toggleProjectTraitType } from '$lib/stores';
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

		const newType: TraitType | undefined = toggleProjectTraitType(layerIdTyped, traitIdTyped);
		if (!newType) return;
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
		class="{flatIconButtonClass} {trait.type === 'ruler' ? 'text-foreground' : ''} {className}"
		data-testid="trait-type-toggle"
		data-trait-type={trait.type || 'normal'}
	>
		<Icon icon={Crown03Icon} class="h-4 w-4" />
	</Button>
{/if}
