<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { pwaInfo } from 'virtual:pwa-info';
	import { ModeWatcher } from 'mode-watcher';
	import Icon from '$components/shared/Icon.svelte';
	import { Home01Icon, Setting07Icon, Image01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
	import '../app.css';
	import { Button } from '$lib/components/ui/button';
	import ThemeToggle from '$lib/components/shared/ThemeToggle.svelte';
	import WindowControls from '$lib/components/shared/WindowControls.svelte';
	import SecurityPolicies from '$lib/components/project/SecurityPolicies.svelte';
	import { setupSessionCleanup } from '$lib/utils/session-cleanup';
	import {
		createProjectFacade,
		createGalleryFacade,
		createGenerationFacade,
		setProjectStoreContext,
		setGalleryStoreContext,
		setGenerationStoreContext
	} from '$lib/stores/facades';

	interface Props {
		children?: Snippet;
	}

	const { children }: Props = $props();

	// Set up store facades in context
	setProjectStoreContext(createProjectFacade());
	setGalleryStoreContext(createGalleryFacade());
	setGenerationStoreContext(createGenerationFacade());

	onMount(() => {
		setupSessionCleanup();
	});

	const webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html webManifestLink}
</svelte:head>

<ModeWatcher />

<div class="bg-background text-foreground min-h-screen">
	<SecurityPolicies />

	<!-- Skip to content link for keyboard users -->
	<a
		href="#main-content"
		class="bg-primary text-primary-foreground focus:ring-primary absolute top-0 left-0 z-50 -translate-y-full rounded-b px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0 focus:ring-2 focus:ring-offset-2"
	>
		Skip to content
	</a>

	<!-- Site Header with Navigation -->
	<header class="border-border bg-background sticky top-0 z-40 border-b-2 font-mono">
		<div class="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<!-- Left: Window Controls + Brand -->
				<WindowControls />

				<!-- Right: Navigation Buttons -->
				<nav class="flex flex-wrap items-center gap-2 sm:gap-2" aria-label="Main navigation">
					<ThemeToggle />

					<Button
						href="/"
						variant={$page.url.pathname === '/' ? 'default' : 'outline'}
						size="sm"
						class="flex items-center gap-1.5"
						title="Home"
					>
						<Icon icon={Home01Icon} class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Home</span>
					</Button>

					<Button
						href="/app"
						variant={$page.url.pathname === '/app' ? 'default' : 'outline'}
						size="sm"
						class="flex items-center gap-1.5"
						title="Studio"
					>
						<Icon icon={Setting07Icon} class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Studio</span>
					</Button>

					<Button
						href="/app/gallery"
						variant={$page.url.pathname === '/app/gallery' ? 'default' : 'outline'}
						size="sm"
						class="flex items-center gap-1.5"
						title="Gallery"
					>
						<Icon icon={Image01Icon} class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Gallery</span>
					</Button>

					<Button
						href="/about"
						variant={$page.url.pathname === '/about' ? 'default' : 'outline'}
						size="sm"
						class="flex items-center gap-1.5"
						title="About"
					>
						<Icon icon={InformationCircleIcon} class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">About</span>
					</Button>
				</nav>
			</div>
		</div>
	</header>

	<main id="main-content" class="min-h-screen">
		{@render children?.()}
	</main>
</div>
