import { BaseMetadataStrategy } from './base.strategy';
import type { GeneratedMetadata, MetadataAttribute, MetadataStrategy } from './metadata.strategy';
import { MetadataStandard } from './metadata.strategy';

export { MetadataStandard };

export class ERC721Strategy extends BaseMetadataStrategy {
	name = MetadataStandard.ERC721;
	description =
		'Standard ERC-721 metadata format compatible with OpenSea and most EVM marketplaces.';

	protected buildPayload(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData: Record<string, unknown>
	): GeneratedMetadata {
		return {
			name,
			description,
			image: imageName,
			external_url: extraData.external_url as string | undefined,
			animation_url: extraData.animation_url as string | undefined,
			youtube_url: extraData.youtube_url as string | undefined,
			background_color: extraData.background_color as string | undefined,
			attributes
		};
	}
}

export class SolanaStrategy extends BaseMetadataStrategy {
	name = MetadataStandard.SOLANA;
	description =
		'Metaplex standard for Solana, including symbol, seller_fee_basis_points, and properties.';

	protected buildPayload(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData: Record<string, unknown>
	): GeneratedMetadata {
		const symbol = (extraData.symbol as string) || '';
		const sellerFeeBasisPoints = (extraData.seller_fee_basis_points as number) || 0;
		const creators =
			(extraData.creators as Array<{ address?: string; share?: number } | string>) || [];
		const collection = (extraData.collection as Record<string, unknown>) || {};
		const externalUrl = (extraData.external_url as string) || '';

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
					{ uri: imageName, type: 'image/png' },
					...(extraData.animation_url
						? [{ uri: extraData.animation_url as string, type: 'video/mp4' }]
						: [])
				],
				category: extraData.animation_url ? 'video' : 'image',
				creators: creators.map((c) => {
					if (typeof c === 'string') {
						return { address: c, share: 100 };
					}
					return {
						address: c.address || String(c),
						share: c.share !== undefined ? c.share : 100
					};
				})
			}
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
