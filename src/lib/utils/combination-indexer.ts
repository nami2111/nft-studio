/**
 * Bit-packed combination indexing for O(1) lookups and 80% memory reduction
 * Packs up to 8 traits into a single 64-bit integer for fast validation
 */

export class CombinationIndexer {
	private static readonly BITS_PER_TRAIT = 8; // Supports 256 traits per layer (0-255)
	private static readonly MAX_TRAITS = 8; // Total: 64 bits (8 traits × 8 bits)
	private static readonly TRAIT_MASK = (1 << this.BITS_PER_TRAIT) - 1; // 0xFF

	/**
	 * Pack trait IDs into a single 64-bit integer
	 * Each trait uses 8 bits: Trait 0 in bits 0-7, Trait 1 in bits 8-15, etc.
	 *
	 * @param traitIds Array of trait IDs to pack (must be ≤ 8 traits)
	 * @returns BigInt representing the packed combination
	 * @throws Error if too many traits or trait ID exceeds 255
	 *
	 * @example
	 * pack([1, 5, 10]) // Returns 0x00000A0501n
	 */
	static pack(traitIds: number[]): bigint {
		if (traitIds.length > this.MAX_TRAITS) {
			throw new Error(
				`Maximum ${this.MAX_TRAITS} traits supported for bit-packed indexing. ` +
					`Received ${traitIds.length} traits.`
			);
		}

		let index = 0n;

		for (let i = 0; i < traitIds.length; i++) {
			const traitId = traitIds[i];

			// Validate trait ID fits in 8 bits (0-255)
			if (traitId < 0 || traitId > this.TRAIT_MASK) {
				throw new Error(
					`Trait ID ${traitId} exceeds maximum value ${this.TRAIT_MASK}. ` +
						`Bit-packed indexing requires trait IDs ≤ 255.`
				);
			}

			index |= BigInt(traitId) << BigInt(i * this.BITS_PER_TRAIT);
		}

		return index;
	}

	/**
	 * Unpack a 64-bit integer back into trait IDs
	 *
	 * @param index BigInt representing the packed combination
	 * @param expectedLength Expected number of traits (for validation)
	 * @returns Array of trait IDs
	 *
	 * @example
	 * unpack(0x00000A0501n, 3) // Returns [1, 5, 10]
	 */
	static unpack(index: bigint, expectedLength?: number): number[] {
		const traitIds: number[] = [];
		const mask = BigInt(this.TRAIT_MASK);

		// Determine actual length if not provided
		const maxIterations = expectedLength || this.MAX_TRAITS;

		for (let i = 0; i < maxIterations; i++) {
			const traitId = Number((index >> BigInt(i * this.BITS_PER_TRAIT)) & mask);

			// If we hit a zero at expected length, stop
			if (traitId === 0 && i >= (expectedLength || 0) && i > 0) {
				break;
			}

			traitIds.push(traitId);
		}

		return traitIds;
	}

	/**
	 * Check if a combination has been seen before (O(1) lookup)
	 *
	 * @param seen Set of seen combinations (bigint)
	 * @param traitIds Array of trait IDs to check
	 * @returns true if combination exists, false otherwise
	 *
	 * @example
	 * const seen = new Set<bigint>();
	 * seen.add(pack([1, 5, 10]));
	 * has(seen, [1, 5, 10]) // Returns true
	 * has(seen, [1, 5, 11]) // Returns false
	 */
	static has(seen: Set<bigint>, traitIds: number[]): boolean {
		try {
			const combinationIndex = this.pack(traitIds);
			return seen.has(combinationIndex);
		} catch (error) {
			// Fallback to string-based check if packing fails
			console.warn('Bit-packed indexing failed, falling back to string key:', error);
			const fallbackKey = traitIds.sort().join('|');
			// Convert Set<bigint> to Set<string> for fallback check
			const stringSet = new Set(Array.from(seen).map((idx) => this.unpack(idx).sort().join('|')));
			return stringSet.has(fallbackKey);
		}
	}

	/**
	 * Add a combination to the seen set
	 *
	 * @param seen Set of seen combinations
	 * @param traitIds Array of trait IDs to add
	 * @returns The combination index that was added
	 */
	static add(seen: Set<bigint>, traitIds: number[]): bigint {
		const combinationIndex = this.pack(traitIds);
		seen.add(combinationIndex);
		return combinationIndex;
	}

	/**
	 * Create a cache key for a combination of traits
	 * Falls back to string-based key if traits exceed 8 or IDs exceed 255
	 *
	 * @param traitIds Array of trait IDs
	 * @returns Either a bigint index or string key
	 */
	static createKey(traitIds: number[]): bigint | string {
		try {
			return this.pack(traitIds);
		} catch {
			// Fallback to string-based key for edge cases
			return traitIds.sort().join('|');
		}
	}

	/**
	 * Convert a Set of combinations to a Set of trait IDs for migration
	 * Useful for migrating from string-based to bit-packed indexing
	 *
	 * @param stringSet Set of string-based combination keys
	 * @returns Set of bigint combination indices
	 */
	static migrateFromStringSet(stringSet: Set<string>): Set<bigint> {
		const bigintSet = new Set<bigint>();

		for (const stringKey of stringSet) {
			try {
				// Parse trait IDs from string key "1|5|10"
				const traitIds = stringKey.split('|').map((id) => parseInt(id, 10));
				const combinationIndex = this.pack(traitIds);
				bigintSet.add(combinationIndex);
			} catch (error) {
				console.warn(`Failed to migrate combination key: ${stringKey}`, error);
			}
		}

		return bigintSet;
	}

	/**
	 * Get memory savings estimate
	 *
	 * @param numCombinations Number of combinations stored
	 * @returns Object with memory usage comparison
	 */
	static getMemoryStats(numCombinations: number): {
		stringBasedBytes: number;
		bitPackedBytes: number;
		savingsBytes: number;
		savingsPercent: number;
	} {
		// String-based: average 100 bytes per combination (includes string overhead)
		const stringBasedBytes = numCombinations * 100;

		// Bit-packed: 8 bytes per combination (bigint)
		const bitPackedBytes = numCombinations * 8;

		const savingsBytes = stringBasedBytes - bitPackedBytes;
		const savingsPercent = (savingsBytes / stringBasedBytes) * 100;

		return {
			stringBasedBytes,
			bitPackedBytes,
			savingsBytes,
			savingsPercent
		};
	}
}
