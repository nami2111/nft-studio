<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Icon from '$components/shared/Icon.svelte';
	import { MoonIcon, Sun01Icon } from '@hugeicons/core-free-icons';
	import { mode, toggleMode } from 'mode-watcher';
</script>

<Button
	variant="outline"
	size="icon"
	class="h-9 w-9"
	onclick={toggleMode}
	aria-label={mode.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<Icon icon={Sun01Icon} class="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
	<Icon icon={MoonIcon} class="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
</Button>
