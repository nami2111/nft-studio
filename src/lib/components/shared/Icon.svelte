<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { IconSvgElement } from '@hugeicons/svelte';

	interface Props {
		icon: IconSvgElement;
		altIcon?: IconSvgElement;
		size?: string | number;
		strokeWidth?: number;
		absoluteStrokeWidth?: boolean;
		color?: string;
		showAlt?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		strokeWidth = 2,
		...rest
	}: Props = $props();
</script>

<HugeiconsIcon strokeWidth={strokeWidth} {...rest} />
