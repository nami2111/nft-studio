<script lang="ts">
	import Icon from '$components/shared/Icon.svelte';
	import { Image01Icon } from '@hugeicons/core-free-icons';

	interface Props {
		message?: string;
	}

	const { message = 'Image needs re-upload' }: Props = $props();
</script>

<div class="flex h-full flex-col items-center justify-center p-2 text-center">
	<div class="text-muted-foreground mb-2">
		<Icon icon={Image01Icon} class="h-8 w-8" />
	</div>
	<span class="text-muted-foreground text-xs">{message}</span>
</div>
