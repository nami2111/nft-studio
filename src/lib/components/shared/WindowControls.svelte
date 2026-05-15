<script lang="ts">
	interface Props {
		/** Additional CSS classes */
		class?: string;
		/** Window title */
		title?: string;
	}

	const { class: className, title = 'GNStudio' }: Props = $props();
</script>

<div class={className + ' flex items-center'}>
	<div class="flex space-x-2">
		<div class="bg-destructive h-3 w-3 rounded-full border-2 border-foreground"></div>
		<div class="bg-warning h-3 w-3 rounded-full border-2 border-foreground"></div>
		<div class="bg-success h-3 w-3 rounded-full border-2 border-foreground"></div>
	</div>
	<div class="text-muted-foreground ml-4 text-sm">{title}</div>
</div>
