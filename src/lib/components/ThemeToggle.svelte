<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Moon, Sun } from 'lucide-svelte';
	import { mode, toggleMode } from 'mode-watcher';

	function toggleTheme() {
		toggleMode();
	}
</script>

<Button
	variant="outline"
	size="icon"
	class="h-9 w-9"
	onclick={toggleMode}
	aria-label={mode.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<Sun class="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
	<Moon class="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
</Button>
