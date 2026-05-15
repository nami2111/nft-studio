<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Icon from '$components/shared/Icon.svelte';
	import { PlayIcon } from '@hugeicons/core-free-icons';

	/* eslint-disable prefer-const */
	let {
		collectionSize = $bindable(),
		isGenerating,
		isBackground,
		onGenerate,
		onCancel
	} = $props<{
		collectionSize: number | null;
		isGenerating: boolean;
		isBackground: boolean;
		onGenerate: (e?: MouseEvent) => void;
		onCancel: () => void;
	}>();
</script>

<div class="space-y-4">
	<!-- Collection Size Input -->
	<div class="grid gap-2 pb-2 sm:grid-cols-[1fr_3fr] sm:items-center sm:gap-4">
		<Label class="sm:text-right" for="collectionSize">Collection Size</Label>
		<Input
			id="collectionSize"
			type="number"
			min="1"
			max="10000"
			bind:value={collectionSize}
			disabled={isGenerating}
		/>
	</div>

	<!-- Action Buttons -->
	<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
		<!-- Background Generation Controls -->
		{#if isBackground}
			<div class="flex w-full gap-2 sm:w-auto">
				<Button variant="outline" onclick={onCancel} size="sm">Stop Background Generation</Button>
			</div>
		{:else if isGenerating}
			<Button variant="outline" onclick={onCancel} size="sm" class="w-full sm:w-auto">
				Cancel
			</Button>
		{/if}

		<!-- Main Generate Button -->
		<Button
			variant="outline"
			onclick={onGenerate}
			disabled={isGenerating ||
				collectionSize === null ||
				collectionSize <= 0 ||
				collectionSize > 10000}
			size="sm"
			class="w-full transition-all sm:w-auto"
		>
			{#if isGenerating}
				Generating...
			{:else}
				<Icon icon={PlayIcon} class="mr-2 h-4 w-4" />
				<span class="text-sm">Generate</span>
			{/if}
		</Button>
	</div>
</div>
