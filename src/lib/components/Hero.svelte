<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
</script>

<section class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
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
		<div class="rounded-xl border border-gray-700 bg-gray-800/30 shadow-2xl backdrop-blur-sm">
			<div class="border-b border-gray-700 px-6 py-4">
				<div class="flex items-center">
					<div class="flex space-x-2">
						<div class="h-3 w-3 rounded-full bg-red-500"></div>
						<div class="h-3 w-3 rounded-full bg-yellow-500"></div>
						<div class="h-3 w-3 rounded-full bg-green-500"></div>
					</div>
					<div class="ml-4 text-sm text-gray-400">NFT Studio</div>
				</div>
			</div>

			<div class="px-8 py-12 sm:px-12 sm:py-16">
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
						<a href="/app">
							<Button
								size="lg"
								class="bg-blue-600 px-8 py-6 font-['JetBrains_Mono'] text-lg text-white hover:bg-blue-700"
							>
								Get Started
							</Button>
						</a>
						<Dialog>
							<DialogTrigger>
								<Button
									variant="outline"
									size="lg"
									class="border-gray-400 px-8 py-6 font-['JetBrains_Mono'] text-lg text-gray-500 hover:border-gray-300 hover:bg-gray-700 hover:text-white"
								>
									Learn More
								</Button>
							</DialogTrigger>
							<DialogContent class="max-h-[80vh] overflow-y-auto border-gray-700 bg-gray-800">
								<DialogHeader>
									<DialogTitle class="font-['JetBrains_Mono'] text-2xl font-bold text-white">
										About the NFT Generative Collection Studio
									</DialogTitle>
									<DialogDescription class="font-['JetBrains_Mono'] text-gray-300">
										This tool allows you to create a generative NFT collection by uploading layers
										of artwork, setting rarity, and generating unique combinations.
									</DialogDescription>
								</DialogHeader>
								<div class="mt-4 space-y-4">
									<h3 class="font-['JetBrains_Mono'] text-lg font-semibold text-white">
										Key Features:
									</h3>
									<ul class="space-y-2 font-['JetBrains_Mono'] text-gray-300">
										<li class="flex items-start">
											<span class="mr-2 text-green-500">✓</span>
											<span>Upload your own artwork in layers</span>
										</li>
										<li class="flex items-start">
											<span class="mr-2 text-green-500">✓</span>
											<span>Adjust rarity weights for each trait</span>
										</li>
										<li class="flex items-start">
											<span class="mr-2 text-green-500">✓</span>
											<span>Generate thousands of unique images and metadata</span>
										</li>
										<li class="flex items-start">
											<span class="mr-2 text-green-500">✓</span>
											<span>Download your entire collection as a .zip file</span>
										</li>
									</ul>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</div>
		</div>

		<!-- Floating elements -->
		<div
			class="absolute -top-6 left-1/4 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/80 shadow-lg"
		>
			<div class="h-6 w-6 rounded-full bg-blue-500"></div>
		</div>
		<div
			class="absolute right-1/3 -bottom-6 flex h-16 w-16 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/80 shadow-lg"
		>
			<div class="h-8 w-8 rounded-md bg-purple-500"></div>
		</div>
	</div>
</section>
