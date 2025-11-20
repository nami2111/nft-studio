<script lang="ts">
	interface Props {
		/** Feature text */
		text: string;
		/** Icon color */
		iconColor?: string;
		/** Additional CSS classes */
		class?: string;
	}

	let { text, iconColor = 'text-green-500', class: className }: Props = $props();
</script>

<li class={className + ' flex items-start'}>
	<span class={iconColor + ' mr-2'}>✓</span>
	<span>{text}</span>
</li>
