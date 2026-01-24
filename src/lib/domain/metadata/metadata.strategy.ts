export interface MetadataAttribute {
	trait_type: string;
	value: string | number | boolean;
	display_type?: string; // For OpenSea (e.g., 'number', 'boost_percentage', 'boost_number', 'date')
	max_value?: number; // For OpenSea numeric traits
}

export interface GeneratedMetadata {
	name: string;
	description: string;
	image: string;
	external_url?: string;
	animation_url?: string;
	youtube_url?: string;
	background_color?: string; // 6 character hex without #
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
