<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import WindowControls from '$lib/components/shared/WindowControls.svelte';
</script>

<section
	class="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-[#F2F2F2] p-4 font-mono text-black sm:p-8 lg:min-h-screen"
>
	<!-- Blueprint Grid Layer -->
	<div class="blueprint-grid absolute inset-0 opacity-[0.07]"></div>

	<!-- Schematic Grid Layout -->
	<div
		class="relative z-10 grid w-full max-w-(--breakpoint-2xl) grid-cols-1 gap-0 border-4 border-black lg:grid-cols-12"
	>
		<!-- Left Column: Typography & Actions -->
		<div
			class="flex flex-col border-b-4 border-black p-6 sm:p-8 lg:col-span-7 lg:border-r-4 lg:border-b-0 lg:p-12"
		>
			<div
				class="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase opacity-60"
			>
				<span class="inline-block h-2 w-2 bg-black"></span>
				<span class="hidden sm:inline">Project: NFT_STUDIO_V0.5.5 //</span> DRAWING NO: BLP-WEB-001
			</div>

			<h1
				class="mb-6 text-3xl leading-[0.85] font-extrabold tracking-tighter break-words uppercase selection:bg-purple-500 selection:text-white md:mb-8 md:text-5xl lg:text-8xl"
			>
				Create<br class="hidden sm:block" /> Stunning<br class="hidden sm:block" /> NFT<br
					class="hidden sm:block"
				/> Collections
			</h1>

			<div class="mb-8 max-w-lg border-l-4 border-black pl-4 md:mb-10 md:pl-6">
				<p
					class="hidden text-xs leading-relaxed font-bold uppercase opacity-80 md:block md:text-base"
				>
					Technical Specifications: ERC-721/1155 Compliant // Instant Pipeline // Multi-Chain Ready.
				</p>
				<p class="text-xs leading-relaxed font-bold uppercase opacity-80 md:hidden">
					ERC-721/1155 // Instant // Multi-Chain
				</p>
			</div>

			<div class="mt-auto flex flex-col gap-4 pt-6 sm:flex-row sm:gap-6 sm:pt-8">
				<Button
					variant="primary"
					size="lg"
					class="h-14 w-full px-8 text-base font-bold tracking-wider sm:w-auto"
					onclick={() => goto(resolve('/app'))}
				>
					START BLUEPRINT ↗
				</Button>
				<Button
					variant="outline"
					size="lg"
					class="h-14 w-full px-8 text-base font-bold tracking-wider sm:w-auto"
					onclick={() => goto(resolve('/about'))}
				>
					DOCS
				</Button>
			</div>
		</div>

		<!-- Right Column: Preview Window -->
		<div class="relative hidden flex-col bg-white lg:col-span-5 lg:flex">
			<div class="flex items-center justify-between border-b-4 border-black bg-gray-100 px-4 py-2">
				<span class="text-[10px] font-bold tracking-tighter uppercase"
					>[WINDOW: PREVIEW_OUTPUT]</span
				>
				<div class="flex gap-2">
					<div class="h-3 w-3 rounded-full border-2 border-black bg-red-400"></div>
					<div class="h-3 w-3 rounded-full border-2 border-black bg-yellow-400"></div>
					<div class="h-3 w-3 rounded-full border-2 border-black bg-green-400"></div>
				</div>
			</div>

			<div class="relative flex-1 overflow-hidden p-6">
				<!-- Mock NFT Grid Preview -->
				<div class="grid grid-cols-2 gap-4 opacity-40 grayscale filter lg:grid-cols-2">
					{#each Array(4) as _}
						<div
							class="flex aspect-square items-center justify-center border-2 border-dashed border-black bg-gray-50"
						>
							<div class="h-2/3 w-2/3 border border-black opacity-20"></div>
						</div>
					{/each}
				</div>

				<!-- Blueprint Overlay Text -->
				<div
					class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4"
				>
					<div class="bg-black px-3 py-1 text-xs font-bold tracking-[0.2em] text-white uppercase">
						Rendering in progress...
					</div>
					<div class="mt-2 font-mono text-[9px] font-bold text-black uppercase">
						Est. Time Remaining: 00:12:45
					</div>
				</div>
			</div>

			<!-- Technical Footer Section -->
			<div class="mt-auto grid grid-cols-2 border-t-4 border-black text-[9px] font-bold uppercase">
				<div class="border-r-4 border-black p-3">
					<div class="opacity-50">Resolution</div>
					<div>4K // Ultra-Def</div>
				</div>
				<div class="p-3">
					<div class="opacity-50">Art Engine</div>
					<div>NEOBR_CORE_v1.0</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Corners & Schematic Elements -->
	<div class="pointer-events-none absolute inset-0 z-0">
		<div class="absolute top-10 left-10 text-xs font-black opacity-20">SECTION A-A</div>
		<div class="absolute right-10 bottom-10 rotate-180 text-xs font-black opacity-20">
			SECTION A-A
		</div>
	</div>
</section>

<style>
	.blueprint-grid {
		background-image:
			linear-gradient(rgba(0, 0, 0, 0.3) 2px, transparent 2px),
			linear-gradient(90deg, rgba(0, 0, 0, 0.3) 2px, transparent 2px),
			linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
		background-size:
			100px 100px,
			100px 100px,
			20px 20px,
			20px 20px;
		background-position:
			-2px -2px,
			-2px -2px,
			-1px -1px,
			-1px -1px;
	}

	:global(section) {
		cursor: crosshair;
	}
</style>
