<script lang="ts">
	import Icon from '$components/shared/Icon.svelte';
	import { CheckmarkBadge01Icon } from '@hugeicons/core-free-icons';

	interface Props {
		/** Feature text */
		text: string;
		/** Icon color */
		iconColor?: string;
		/** Additional CSS classes */
		class?: string;
	}

	const { text, iconColor = 'text-green-500', class: className }: Props = $props();
</script>

<li class={className + ' flex items-start'}>
	<span class="mr-2"><Icon icon={CheckmarkBadge01Icon} class={iconColor + ' h-4 w-4 mt-0.5'} /></span>
	<span>{text}</span>
</li>
