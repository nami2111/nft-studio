<script lang="ts">
	interface Props {
		/** Additional CSS classes */
		class?: string;
		/** Window title */
		title?: string;
	}

	let { class: className, title = 'NFT Studio' }: Props = $props();
</script>

<div class={className + ' flex items-center'}>
	<div class="flex space-x-2">
		<div class="h-3 w-3 rounded-full bg-red-500"></div>
		<div class="h-3 w-3 rounded-full bg-yellow-500"></div>
		<div class="h-3 w-3 rounded-full bg-green-500"></div>
	</div>
	<div class="ml-4 text-sm text-gray-400">{title}</div>
</div>
