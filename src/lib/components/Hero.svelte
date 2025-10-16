<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import FloatingElement from '$lib/components/FloatingElement.svelte';
	import WindowControls from '$lib/components/WindowControls.svelte';
</script>

<section
	class="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4"
>
	<!-- Decorative background elements -->
	<div class="absolute inset-0 overflow-hidden">
		<!-- High contrast gradient with transparent center -->
		<div
			class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.05)_40%,rgba(0,0,0,0)_70%)]"
		></div>

		<!-- Blockchain element centered -->
		<div class="absolute inset-0 flex items-center justify-center">
			<img
				src="/blockchain-element.webp"
				alt="Blockchain element"
				class="z-0 opacity-60"
				style="max-width: 2000px; width: 250%; height: auto; filter: contrast(1.2);"
			/>
			<!-- High contrast inverse circle gradient overlay -->
			<div
				class="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0)_0%,rgba(255,255,255,0.3)_40%,rgba(255,255,255,0.8)_70%)]"
			></div>
		</div>
	</div>

	<div class="relative z-10 mx-auto w-full max-w-4xl">
		<!-- High contrast card -->
		<Card class="shadow-2xl backdrop-blur-sm">
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
						<Button size="lg" onclick={() => goto(resolve('/app'))}>Get Started</Button>
						<Button variant="outline" size="lg" onclick={() => goto(resolve('/about'))}
							>Learn More</Button
						>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- High contrast floating elements -->
		<div
			class="border-foreground bg-card absolute -top-6 left-1/4 flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-lg"
		>
			<FloatingElement bgColor="bg-foreground" shape="circle" size="h-6 w-6" />
		</div>
		<div
			class="border-foreground bg-card absolute right-1/3 -bottom-6 flex h-16 w-16 items-center justify-center rounded-lg border-2 shadow-lg"
		>
			<FloatingElement bgColor="bg-muted" shape="square" size="h-8 w-8" />
		</div>
	</div>
</section>
