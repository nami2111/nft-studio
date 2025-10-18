<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import FloatingElement from '$lib/components/FloatingElement.svelte';
	import WindowControls from '$lib/components/WindowControls.svelte';
</script>

<section
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#002859]"
>
	<!-- Decorative background elements -->
	<div class="absolute inset-0 overflow-hidden">
		<!-- Blockchain element centered -->
		<div class="absolute inset-0 flex items-center justify-center overflow-hidden">
			<img
				src="/blockchain-element.webp"
				alt="Blockchain element"
				class="z-0 h-full w-full object-cover opacity-60 md:h-auto md:w-auto md:max-w-[2000px]"
				style="filter: contrast(1.2); min-width: 100%; min-height: 100%;"
			/>
			<!-- Gradient overlay -->
			<div
				class="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(6,17,43,0)_0%,rgba(6,17,43,0.5)_40%,rgba(6,17,43,1)_70%)]"
			></div>
		</div>
	</div>

	<div class="relative z-20 mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
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
					<div
						class="mt-10 flex flex-col justify-center gap-4 sm:flex-row sm:items-center sm:justify-center"
					>
						<Button
							size="lg"
							class="w-full bg-white text-black transition-all hover:scale-105 hover:bg-gray-100 hover:shadow-lg sm:w-auto"
							onclick={() => goto(resolve('/app'))}
						>
							Get Started
						</Button>
						<Button
							variant="outline"
							size="lg"
							class="w-full transition-all hover:scale-105 hover:shadow-lg sm:w-auto"
							onclick={() => goto(resolve('/about'))}
						>
							Learn More
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</section>
