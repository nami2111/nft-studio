<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import FloatingElement from '$lib/components/FloatingElement.svelte';
	import WindowControls from '$lib/components/WindowControls.svelte';
</script>

<section
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#002859] px-4"
>
	<!-- Decorative background elements -->
	<div class="absolute inset-0 overflow-hidden">
		<!-- Blockchain element centered -->
		<div class="absolute inset-0 flex items-center justify-center">
			<img
				src="/blockchain-element.webp"
				alt="Blockchain element"
				class="z-0 opacity-60"
				style="max-width: 2000px; width: 250%; height: auto; filter: contrast(1.2);"
			/>
			<!-- Gradient overlay -->
			<div
				class="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(6,17,43,0)_0%,rgba(6,17,43,0.5)_40%,rgba(6,17,43,1)_70%)]"
			></div>
		</div>
	</div>

	<div class="relative z-20 mx-auto w-full max-w-4xl">
		<!-- High contrast card -->
		<Card class="text-white shadow-2xl backdrop-blur-sm">
			<CardHeader class="px-6 py-4">
				<WindowControls title="NFT Studio" />
			</CardHeader>

			<CardContent class="px-8 py-12 sm:px-12 sm:py-16">
				<div class="text-center">
					<h1 class="text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
						Create Stunning NFT Collections
					</h1>
					<p class="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg md:text-xl">
						Design, generate, and manage your NFT collections with our powerful studio tools.
						Perfect for artists, creators, and collectors.
					</p>
					<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
						<div class="inline-flex">
							<button
								class="ring-offset-background focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md bg-white px-8 text-lg font-medium whitespace-nowrap text-black transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
								onclick={() => goto(resolve('/app'))}>Get Started</button
							>
						</div>
						<Button variant="outline" size="lg" onclick={() => goto(resolve('/about'))}
							>Learn More</Button
						>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</section>
