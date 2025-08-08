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
	import { Moon, Sun } from 'lucide-svelte';
</script>

<section class="py-20 text-center">
	<h1 class="text-5xl font-bold">NFT Generative Collection Studio</h1>
	<p class="mt-4 text-xl text-gray-600">Create your own unique NFT collection with ease.</p>
	<div class="mt-8 flex justify-center space-x-4">
		<Button
			size="lg"
			onclick={() =>
				document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' })}
			>Get Started</Button
		>
		<Dialog>
			<DialogTrigger>
				<Button variant="outline" size="lg">Learn More</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>About the NFT Generative Collection Studio</DialogTitle>
					<DialogDescription>
						This tool allows you to create a generative NFT collection by uploading layers of
						artwork, setting rarity, and generating unique combinations.
					</DialogDescription>
				</DialogHeader>
				<div class="prose">
					<p>Key Features:</p>
					<ul>
						<li>Upload your own artwork in layers.</li>
						<li>Adjust rarity weights for each trait.</li>
						<li>Generate thousands of unique images and metadata.</li>
						<li>Download your entire collection as a .zip file.</li>
					</ul>
				</div>
			</DialogContent>
		</Dialog>
	</div>
</section>
