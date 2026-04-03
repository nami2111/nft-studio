<script lang="ts">
	import {
		project,
		updateProjectName,
		updateProjectDescription,
		updateProjectMetadataStandard,
		updateProjectSymbol,
		updateProjectSellerFee,
		updateProjectExternalUrl,
		updateProjectAnimationUrl
	} from '$lib/stores';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { showSuccess, showWarning } from '$lib/utils/error-handling';
	import { MetadataStandard } from '$lib/domain/metadata/strategies';

	let projectName = $state('');
	let projectDescription = $state('');
	let metadataStandard = $state(MetadataStandard.ERC721);
	let symbol = $state('');
	let sellerFeeBasisPoints = $state(0);
	let externalUrl = $state('');
	let animationUrl = $state('');

	// Track focused fields to avoid overwriting unsaved edits
	let focusedField = $state<string | null>(null);

	const MAX_NAME_LENGTH = 100;
	const MAX_DESC_LENGTH = 500;

	// Sync with project store changes (skip focused fields to preserve unsaved edits)
	$effect(() => {
		const currentProject = project;
		if (focusedField !== 'projectName') projectName = currentProject.name;
		if (focusedField !== 'projectDescription') projectDescription = currentProject.description;
		if (focusedField !== 'metadataStandard')
			metadataStandard = currentProject.metadataStandard || MetadataStandard.ERC721;
		if (focusedField !== 'symbol') symbol = currentProject.symbol || '';
		if (focusedField !== 'sellerFee')
			sellerFeeBasisPoints = currentProject.sellerFeeBasisPoints || 0;
		if (focusedField !== 'externalUrl') externalUrl = currentProject.externalUrl || '';
		if (focusedField !== 'animationUrl') animationUrl = currentProject.animationUrl || '';
	});

	// Save project name
	function saveProjectName(value: string) {
		projectName = value;
		if (projectName.trim() === '') {
			showWarning('Project name cannot be empty.', { description: 'Validation Error' });
			return;
		}
		if (projectName.length > MAX_NAME_LENGTH) {
			showWarning(`Project name cannot exceed ${MAX_NAME_LENGTH} characters.`, {
				description: 'Validation Error'
			});
			return;
		}
		updateProjectName(projectName);
		showSuccess('Project name saved.');
	}

	// Save project description
	function saveProjectDescription(value: string) {
		projectDescription = value;
		if (projectDescription.length > MAX_DESC_LENGTH) {
			showWarning(`Description cannot exceed ${MAX_DESC_LENGTH} characters.`, {
				description: 'Validation Error'
			});
			return;
		}
		updateProjectDescription(projectDescription);
	}

	// Save metadata standard
	function saveMetadataStandard(value: MetadataStandard) {
		metadataStandard = value;
		updateProjectMetadataStandard(metadataStandard);
		showSuccess('Metadata standard saved.', {
			description: `Switched to ${value.toUpperCase()} format`
		});
	}

	function saveSymbol(value: string) {
		symbol = value;
		updateProjectSymbol(symbol);
	}

	function saveSellerFee(value: number) {
		sellerFeeBasisPoints = value;
		updateProjectSellerFee(sellerFeeBasisPoints);
	}

	function saveExternalUrl(value: string) {
		externalUrl = value;
		updateProjectExternalUrl(externalUrl);
	}

	function saveAnimationUrl(value: string) {
		animationUrl = value;
		updateProjectAnimationUrl(animationUrl);
	}
</script>

<div class="space-y-4 sm:space-y-6">
	<div class="space-y-3 sm:space-y-4">
		<h3 class="text-foreground text-sm font-semibold tracking-wider uppercase">
			General Information
		</h3>
		<div>
			<label for="projectName" class="text-foreground block text-xs font-medium sm:text-sm"
				>Project Name</label
			>
			<Input
				id="projectName"
				type="text"
				value={projectName}
				onchange={(e: Event) => saveProjectName((e.target as HTMLInputElement).value)}
				onkeydown={(e) => e.key === 'Enter' && saveProjectName(projectName)}
				onfocus={() => (focusedField = 'projectName')}
				onblur={() => (focusedField = null)}
				placeholder="Enter project name"
				class="text-xs sm:text-sm"
			/>
			<p class="text-muted-foreground mt-1 text-xs">{projectName.length}/{MAX_NAME_LENGTH}</p>
		</div>

		<div>
			<label for="projectDescription" class="text-foreground block text-xs font-medium sm:text-sm"
				>Description</label
			>
			<Textarea
				id="projectDescription"
				rows={3}
				value={projectDescription}
				onchange={(e: Event) => saveProjectDescription((e.target as HTMLTextAreaElement).value)}
				onfocus={() => (focusedField = 'projectDescription')}
				onblur={() => (focusedField = null)}
				placeholder="Enter project description"
				class="text-xs sm:text-sm"
			/>
			<p class="text-muted-foreground mt-1 text-xs">
				{projectDescription.length}/{MAX_DESC_LENGTH}
			</p>
		</div>
	</div>

	<hr class="border-border" />

	<div class="space-y-3 sm:space-y-4">
		<h3 class="text-foreground text-sm font-semibold tracking-wider uppercase">
			Advanced Metadata
		</h3>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="symbol" class="text-foreground block text-xs font-medium sm:text-sm"
					>Symbol</label
				>
				<Input
					id="symbol"
					type="text"
					value={symbol}
					onchange={(e: Event) => saveSymbol((e.target as HTMLInputElement).value)}
					onfocus={() => (focusedField = 'symbol')}
					onblur={() => (focusedField = null)}
					placeholder="e.g. NFT"
					class="text-xs uppercase sm:text-sm"
				/>
				<p class="text-muted-foreground mt-1 text-xs">Token symbol (Solana required)</p>
			</div>

			<div>
				<label for="sellerFee" class="text-foreground block text-xs font-medium sm:text-sm"
					>Seller Fee (BPS)</label
				>
				<Input
					id="sellerFee"
					type="number"
					value={sellerFeeBasisPoints}
					onchange={(e: Event) =>
						saveSellerFee(parseInt((e.target as HTMLInputElement).value) || 0)}
					onfocus={() => (focusedField = 'sellerFee')}
					onblur={() => (focusedField = null)}
					placeholder="e.g. 500 (5%)"
					class="text-xs sm:text-sm"
				/>
				<p class="text-muted-foreground mt-1 text-xs">Fee in basis points (100 = 1%)</p>
			</div>
		</div>

		<div>
			<label for="externalUrl" class="text-foreground block text-xs font-medium sm:text-sm"
				>External URL</label
			>
			<Input
				id="externalUrl"
				type="url"
				value={externalUrl}
				onchange={(e: Event) => saveExternalUrl((e.target as HTMLInputElement).value)}
				onfocus={() => (focusedField = 'externalUrl')}
				onblur={() => (focusedField = null)}
				placeholder="https://yourwebsite.com/nft/1"
				class="text-xs sm:text-sm"
			/>
			<p class="text-muted-foreground mt-1 text-xs">Optional link to your project website</p>
		</div>

		<div>
			<label for="animationUrl" class="text-foreground block text-xs font-medium sm:text-sm"
				>Animation/Video URL</label
			>
			<Input
				id="animationUrl"
				type="url"
				value={animationUrl}
				onchange={(e: Event) => saveAnimationUrl((e.target as HTMLInputElement).value)}
				onfocus={() => (focusedField = 'animationUrl')}
				onblur={() => (focusedField = null)}
				placeholder="ipfs://... or https://..."
				class="text-xs sm:text-sm"
			/>
			<p class="text-muted-foreground mt-1 text-xs">Link to video or multimedia asset</p>
		</div>
	</div>

	<hr class="border-border" />

	<div class="space-y-3 sm:space-y-4">
		<h3 class="text-foreground text-sm font-semibold tracking-wider uppercase">
			Standard Configuration
		</h3>
		<div>
			<label for="metadataStandard" class="text-foreground block text-xs font-medium sm:text-sm"
				>Marketplace Standard</label
			>
			<div class="grid gap-2">
				<div class="flex gap-4">
					<label class="flex items-center gap-2 text-xs sm:text-sm">
						<input
							type="radio"
							name="metadataStandard"
							value={MetadataStandard.ERC721}
							checked={metadataStandard === MetadataStandard.ERC721}
							onchange={() => saveMetadataStandard(MetadataStandard.ERC721)}
							class="text-primary focus:ring-primary border-input bg-background"
						/>
						<span class="font-medium">ERC-721 (EVM)</span>
					</label>
					<label class="flex items-center gap-2 text-xs sm:text-sm">
						<input
							type="radio"
							name="metadataStandard"
							value={MetadataStandard.SOLANA}
							checked={metadataStandard === MetadataStandard.SOLANA}
							onchange={() => saveMetadataStandard(MetadataStandard.SOLANA)}
							class="text-primary focus:ring-primary border-input bg-background"
						/>
						<span class="font-medium">Metaplex (Solana)</span>
					</label>
				</div>
				<p class="text-muted-foreground text-xs italic">
					{metadataStandard === MetadataStandard.ERC721
						? 'Optimized for OpenSea, LooksRare, and other Ethereum/EVM marketplaces.'
						: 'Metaplex JSON standard for Solana marketplaces like Magic Eden.'}
				</p>
			</div>
		</div>
	</div>

	<div class="bg-muted rounded-md border p-3 sm:p-4">
		<h4 class="text-foreground mb-1 text-xs font-medium sm:text-sm">Current Project Dimensions</h4>
		<p class="text-muted-foreground mb-1 text-xs sm:text-sm">
			{project.outputSize.width}px × {project.outputSize.height}px
		</p>
		<p class="text-muted-foreground text-[10px] sm:text-xs">
			Dimensions are locked once traits are uploaded to ensure consistency.
		</p>
	</div>
</div>
