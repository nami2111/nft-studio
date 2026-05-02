/**
 * Test suite for metadata strategies.
 *
 * @module strategies.test
 */

import { describe, expect, it } from "vite-plus/test";
import {
	ERC721Strategy,
	getMetadataStrategy,
	MetadataStandard,
	SolanaStrategy,
} from "./strategies";

describe("getMetadataStrategy", () => {
	it("returns ERC721Strategy for ERC721 standard", () => {
		const s = getMetadataStrategy(MetadataStandard.ERC721);
		expect(s).toBeInstanceOf(ERC721Strategy);
	});

	it("returns SolanaStrategy for SOLANA standard", () => {
		const s = getMetadataStrategy(MetadataStandard.SOLANA);
		expect(s).toBeInstanceOf(SolanaStrategy);
	});
});

describe("ERC721Strategy", () => {
	const strategy = new ERC721Strategy();
	const baseAttrs = [{ trait_type: "Background", value: "Blue" }];

	it("has correct name and description", () => {
		expect(strategy.name).toBe(MetadataStandard.ERC721);
		expect(strategy.description).toContain("ERC-721");
	});

	it("formats basic metadata", () => {
		const result = strategy.format("NFT #1", "A test NFT", "1.png", baseAttrs);

		expect(result.name).toBe("NFT #1");
		expect(result.description).toBe("A test NFT");
		expect(result.image).toBe("1.png");
		expect(result.attributes).toEqual(baseAttrs);
	});

	it("passes through extraData fields", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			external_url: "https://example.com",
			animation_url: "https://example.com/video.mp4",
			background_color: "FF0000",
		});

		expect(result.external_url).toBe("https://example.com");
		expect(result.animation_url).toBe("https://example.com/video.mp4");
		expect(result.background_color).toBe("FF0000");
	});

	it("spreads extra arbitrary extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			custom_field: "hello",
		});

		expect((result as Record<string, unknown>).custom_field).toBe("hello");
	});

	it("returns undefined for missing optional fields", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs);

		expect(result.external_url).toBeUndefined();
		expect(result.animation_url).toBeUndefined();
		expect(result.background_color).toBeUndefined();
	});
});

describe("SolanaStrategy", () => {
	const strategy = new SolanaStrategy();
	const baseAttrs = [{ trait_type: "Eyes", value: "Green" }];

	it("has correct name and description", () => {
		expect(strategy.name).toBe(MetadataStandard.SOLANA);
		expect(strategy.description).toContain("Metaplex");
	});

	it("formats basic metadata", () => {
		const result = strategy.format(
			"NFT #1",
			"A Solana NFT",
			"1.png",
			baseAttrs,
		);

		expect(result.name).toBe("NFT #1");
		// symbol is injected via extraData spread — use any to read
		expect((result as Record<string, unknown>).symbol).toBe("");
		expect(result.description).toBe("A Solana NFT");
		expect((result as Record<string, unknown>).seller_fee_basis_points).toBe(0);
		expect(result.image).toBe("1.png");
		expect(result.attributes).toEqual(baseAttrs);
	});

	it("includes symbol from extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			symbol: "TEST",
		});

		expect((result as Record<string, unknown>).symbol).toBe("TEST");
	});

	it("includes seller_fee_basis_points from extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			seller_fee_basis_points: 500,
		});

		expect((result as Record<string, unknown>).seller_fee_basis_points).toBe(
			500,
		);
	});

	it("includes external_url from extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			external_url: "https://example.com",
		});

		expect(result.external_url).toBe("https://example.com");
	});

	it("generates properties.files with image entry", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs);
		const r = result as Record<string, unknown>;
		const props = r.properties as Record<string, unknown>;
		const files = props.files as Array<Record<string, unknown>>;

		expect(props).toBeDefined();
		expect(files).toHaveLength(1);
		expect(files[0]).toEqual({ uri: "1.png", type: "image/png" });
		expect(props.category).toBe("image");
	});

	it("adds animation file when animation_url is provided", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			animation_url: "https://example.com/video.mp4",
		});
		const r = result as Record<string, unknown>;
		const props = r.properties as Record<string, unknown>;
		const files = props.files as Array<Record<string, unknown>>;

		expect(files).toHaveLength(2);
		expect(files[1]).toEqual({
			uri: "https://example.com/video.mp4",
			type: "video/mp4",
		});
		expect(props.category).toBe("video");
	});

	it("handles string creators (single address)", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			creators: ["addr1", "addr2"],
		});
		const r = result as Record<string, unknown>;
		const props = r.properties as Record<string, unknown>;

		expect(props.creators).toEqual([
			{ address: "addr1", share: 100 },
			{ address: "addr2", share: 100 },
		]);
	});

	it("handles object creators with address and share", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			creators: [
				{ address: "addr1", share: 70 },
				{ address: "addr2", share: 30 },
			],
		});
		const r = result as Record<string, unknown>;
		const props = r.properties as Record<string, unknown>;

		expect(props.creators).toEqual([
			{ address: "addr1", share: 70 },
			{ address: "addr2", share: 30 },
		]);
	});

	it("handles mixed creator formats", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			creators: ["simple_addr", { address: "detailed_addr" }],
		});
		const r = result as Record<string, unknown>;
		const props = r.properties as Record<string, unknown>;

		expect(props.creators).toEqual([
			{ address: "simple_addr", share: 100 },
			{ address: "detailed_addr", share: 100 },
		]);
	});

	it("passes through collection from extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			collection: { name: "My Collection", family: "My Family" },
		});

		expect((result as Record<string, unknown>).collection).toEqual({
			name: "My Collection",
			family: "My Family",
		});
	});

	it("spreads extra arbitrary extraData", () => {
		const result = strategy.format("NFT #1", "desc", "1.png", baseAttrs, {
			custom: "value",
		});

		expect((result as Record<string, unknown>).custom).toBe("value");
	});
});
