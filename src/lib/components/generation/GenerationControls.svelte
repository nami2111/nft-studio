<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Play } from 'lucide-svelte';

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
		<label class="text-sm font-medium sm:text-right" for="collectionSize">Collection Size</label>
		<input
			id="collectionSize"
			type="number"
			min="1"
			max="10000"
			class="border-input bg-background focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
				Canceling...
			</Button>
		{/if}

		<!-- Main Generate Button -->
		<Button
			variant="outline"
			onclick={onGenerate}
			disabled={isGenerating || collectionSize <= 0 || collectionSize > 10000}
			size="sm"
			class="w-full transition-all sm:w-auto"
		>
			{#if isGenerating}
				Generating...
			{:else}
				<Play class="mr-2 h-4 w-4" />
				<span class="text-sm">Generate</span>
			{/if}
		</Button>
	</div>
</div>
