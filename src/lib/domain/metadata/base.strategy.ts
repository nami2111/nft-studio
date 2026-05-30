import type { GeneratedMetadata, MetadataAttribute, MetadataStrategy } from './metadata.strategy';
import { MetadataStandard } from './metadata.strategy';

/**
 * Base strategy with shared field handling.
 *
 * Subclasses implement {@link buildPayload} for format-specific shape.
 * The base handles common concerns: attribute pass-through, extraData merging,
 * and post-validation (override {@link validateOutput} to fail-fast on bad output).
 */
export abstract class BaseMetadataStrategy implements MetadataStrategy {
	abstract name: string;
	abstract description: string;

	format(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData?: Record<string, unknown>
	): GeneratedMetadata {
		const payload = this.buildPayload(name, description, imageName, attributes, extraData ?? {});
		const merged = { ...payload, ...this.passthrough(extraData ?? {}) };
		this.validateOutput(merged);
		return merged;
	}

	/**
	 * Subclass-specific metadata shape. Receives a guaranteed-non-null extraData.
	 */
	protected abstract buildPayload(
		name: string,
		description: string,
		imageName: string,
		attributes: MetadataAttribute[],
		extraData: Record<string, unknown>
	): GeneratedMetadata;

	/**
	 * Fields from extraData that should always be passed through to output.
	 * Default: pass everything (callers can opt into stricter strategies).
	 */
	protected passthrough(extraData: Record<string, unknown>): Record<string, unknown> {
		return extraData;
	}

	/**
	 * Validate output. Default: assert required fields present.
	 * Override to add format-specific checks.
	 */
	protected validateOutput(output: GeneratedMetadata): void {
		if (!output.name || !output.image) {
			throw new Error(`${this.name} metadata missing required fields`);
		}
	}
}

export { MetadataStandard };
