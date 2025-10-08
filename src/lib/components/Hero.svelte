<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import FloatingElement from '$lib/components/FloatingElement.svelte';
	import WindowControls from '$lib/components/WindowControls.svelte';
</script>

<section class="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
	<!-- Decorative background elements -->
	<div class="absolute inset-0 overflow-hidden">
		<!-- Custom gradient with transparent center -->
		<div
			class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1)_0%,rgba(59,130,246,0.05)_40%,rgba(0,0,0,0)_70%)]"
		></div>

		<!-- Blockchain element centered -->
		<div class="absolute inset-0 flex items-center justify-center">
			<img
				src="/blockchain-element.webp"
				alt="Blockchain element"
				class="z-0 opacity-80"
				style="max-width: 2000px; width: 250%; height: auto;"
			/>
			<!-- Inverse circle gradient overlay -->
			<div
				class="absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(6,17,43,0)_0%,rgba(6,17,43,0.5)_40%,rgba(6,17,43,1)_70%)]"
			></div>
		</div>
	</div>

	<div class="relative z-10 mx-auto w-full max-w-4xl">
		<!-- Figma-style card -->
		<Card class="border border-gray-700 bg-gray-800/30 shadow-2xl backdrop-blur-sm">
			<CardHeader class="border-b border-gray-700 px-6 py-4">
				<WindowControls title="NFT Studio" />
			</CardHeader>

			<CardContent class="px-8 py-12 sm:px-12 sm:py-16">
				<div class="text-center">
					<h1
						class="font-['JetBrains_Mono'] text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl"
					>
						Create Stunning NFT Collections
					</h1>
					<p
						class="mx-auto mt-6 max-w-2xl font-['JetBrains_Mono'] text-lg text-gray-300 md:text-xl"
					>
						Design, generate, and manage your NFT collections with our powerful studio tools.
						Perfect for artists, creators, and collectors.
					</p>
					<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
						<Button
							size="lg"
							class="bg-blue-600 px-8 py-6 font-['JetBrains_Mono'] text-lg text-white hover:bg-blue-700"
							onclick={() => goto(resolve('/app'))}
						>
							Get Started
						</Button>
						<Button
							variant="outline"
							size="lg"
							class="border-gray-400 px-8 py-6 font-['JetBrains_Mono'] text-lg text-gray-500 hover:border-gray-300 hover:bg-gray-700 hover:text-white"
							onclick={() => goto('/about')}
						>
							Learn More
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Floating elements -->
		<div
			class="absolute -top-6 left-1/4 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/80 shadow-lg"
		>
			<FloatingElement bgColor="bg-blue-500" shape="circle" size="h-6 w-6" />
		</div>
		<div
			class="absolute right-1/3 -bottom-6 flex h-16 w-16 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/80 shadow-lg"
		>
			<FloatingElement bgColor="bg-purple-500" shape="square" size="h-8 w-8" />
		</div>
	</div>
</section>
