export interface MetadataAttribute {
	trait_type: string;
	value: string | number | boolean;
	display_type?: string; // For OpenSea (e.g., 'number', 'boost_percentage')
}

export interface GeneratedMetadata {
	name: string;
	description: string;
	image: string;
	attributes: MetadataAttribute[];
	[key: string]: unknown; // Allow other properties
}

export interface MetadataStrategy {
	name: string;
	description: string;
	format(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData?: Record<string, unknown>
	): GeneratedMetadata;
}

export enum MetadataStandard {
	ERC721 = 'erc721',
	SOLANA = 'solana'
}
