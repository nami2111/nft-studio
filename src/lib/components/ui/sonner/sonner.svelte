<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';
	import { mode } from 'mode-watcher';

	let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	style="--normal-bg: hsl(var(--card)); --normal-text: hsl(var(--foreground)); --normal-border: hsl(var(--border)); --success-bg: hsl(var(--card)); --success-text: hsl(var(--foreground)); --success-border: hsl(var(--border)); --error-bg: hsl(var(--card)); --error-text: hsl(var(--foreground)); --error-border: hsl(var(--destructive)); --warning-bg: hsl(var(--card)); --warning-text: hsl(var(--foreground)); --warning-border: hsl(var(--border)); --info-bg: hsl(var(--card)); --info-text: hsl(var(--foreground)); --info-border: hsl(var(--border)); --color-bg: hsl(var(--card)); --color-fg: hsl(var(--foreground)); --text-color: hsl(var(--foreground)); --title-color: hsl(var(--foreground)); --description-color: hsl(var(--foreground));"
	{...restProps}
/>
