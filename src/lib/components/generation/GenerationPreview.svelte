<script lang="ts">
	// This component will be used to display previews in a grid
	// Currently the previews are handled via the gallery or not shown directly in the form in a grid
	// But we can add it here for future enhancement

	let { previews } = $props<{
		previews: { index: number; url: string }[];
	}>();
</script>

{#if previews.length > 0}
	<div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
		{#each previews as preview (preview.index)}
			<div class="bg-muted aspect-square overflow-hidden rounded-md border">
				<img src={preview.url} alt="Preview {preview.index}" class="h-full w-full object-cover" />
			</div>
		{/each}
	</div>
{/if}
