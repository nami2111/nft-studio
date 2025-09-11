<script lang="ts">
	interface Props {
		/** Background color class */
		bgColor?: string;
		/** Shape of the element */
		shape?: 'circle' | 'square';
		/** Size classes */
		size?: string;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		bgColor = 'bg-blue-500',
		shape = 'circle',
		size = 'h-6 w-6',
		class: className
	}: Props = $props();

	// Generate shape class
	let shapeClass = $derived(shape === 'circle' ? 'rounded-full' : 'rounded-md');
</script>

<div class={className}>
	<div class={shapeClass + ' ' + size + ' ' + bgColor}></div>
</div>
