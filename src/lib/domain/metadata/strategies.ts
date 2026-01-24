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
			image: imageName,
			external_url: extraData?.external_url as string | undefined,
			animation_url: extraData?.animation_url as string | undefined,
			youtube_url: extraData?.youtube_url as string | undefined,
			background_color: extraData?.background_color as string | undefined,
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
		const symbol = (extraData?.symbol as string) || '';
		const sellerFeeBasisPoints = (extraData?.seller_fee_basis_points as number) || 0;
		const creators = (extraData?.creators as any[]) || [];
		const collection = (extraData?.collection as Record<string, unknown>) || {};
		const externalUrl = (extraData?.external_url as string) || '';

		return {
			name,
			symbol,
			description,
			seller_fee_basis_points: sellerFeeBasisPoints,
			image: imageName,
			external_url: externalUrl,
			attributes,
			collection,
			properties: {
				files: [
					{
						uri: imageName,
						type: 'image/png'
					},
					...(extraData?.animation_url
						? [{ uri: extraData.animation_url as string, type: 'video/mp4' }]
						: [])
				],
				category: extraData?.animation_url ? 'video' : 'image',
				creators: creators.map((c) => ({
					address: c.address || c,
					share: c.share !== undefined ? c.share : 100
				}))
			},
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
