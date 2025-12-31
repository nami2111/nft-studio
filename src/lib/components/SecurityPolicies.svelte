<script lang="ts">
	import { onMount } from 'svelte';
	import { initTrustedTypesPolicy } from '$lib/utils/sanitization';

	onMount(() => {
		// Initialize Trusted Types policy for XSS prevention
		initTrustedTypesPolicy();
	});
</script>
