import type { MetadataStrategy, GeneratedMetadata, MetadataAttribute } from './metadata.strategy';
import { MetadataStandard } from './metadata.strategy';

export { MetadataStandard };

export class ERC721Strategy implements MetadataStrategy {
	name = MetadataStandard.ERC721;
	description =
		'Standard ERC-721 metadata format compatible with OpenSea and most EVM marketplaces.';

	format(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData?: Record<string, unknown>
	): GeneratedMetadata {
		return {
			name,
			description,
			image: imageName, // Usually expects an IPFS URL, but we generate local filename first
			attributes,
			...extraData
		};
	}
}

export class SolanaStrategy implements MetadataStrategy {
	name = MetadataStandard.SOLANA;
	description =
		'Metaplex standard for Solana NFTs, including symbol, seller_fee_basis_points, and properties.';

	format(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData?: Record<string, unknown>
	): GeneratedMetadata {
		// Solana specific defaults
		const symbol = (extraData?.symbol as string) || '';
		const sellerFeeBasisPoints = (extraData?.seller_fee_basis_points as number) || 0;
		const creators = (extraData?.creators as unknown[]) || [];
		const collection = (extraData?.collection as Record<string, unknown>) || {};

		return {
			name,
			symbol,
			description,
			image: imageName,
			seller_fee_basis_points: sellerFeeBasisPoints,
			attributes,
			properties: {
				files: [
					{
						uri: imageName,
						type: 'image/png'
					}
				],
				category: 'image',
				creators
			},
			collection,
			...extraData
		};
	}
}

export const metadataStrategies: Record<MetadataStandard, MetadataStrategy> = {
	[MetadataStandard.ERC721]: new ERC721Strategy(),
	[MetadataStandard.SOLANA]: new SolanaStrategy()
};

export function getMetadataStrategy(standard: MetadataStandard): MetadataStrategy {
	return metadataStrategies[standard] || metadataStrategies[MetadataStandard.ERC721];
}
