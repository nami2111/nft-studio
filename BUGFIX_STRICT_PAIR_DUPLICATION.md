# Bug Fix: Strict Pair Configuration Generating Duplicate Combinations

## Issue Description
When generating NFTs with active strict pair configuration, duplicate pairs of layers were being generated despite being configured to prevent this behavior. The strict pair rules were not being properly enforced during generation.

## Root Cause
The bug was in the hybrid indexing implementation for tracking used trait combinations:

1. **Bit-Packed Path (Working)**: When trait IDs were ≤ 255 and ≤ 8 traits per combination:
   - Combinations were correctly stored in `usedSet` using `CombinationIndexer.pack()`
   - CSP solver could detect and prevent duplicates

2. **Hash-Based Fallback Path (Broken)**: When trait IDs > 255 or > 8 traits per combination:
   - Combinations were stored in `combinationHashes` Map but NOT in `usedSet`
   - CSP solver only checked `usedSet`, so it couldn't detect these combinations
   - Result: Duplicates were allowed through validation

## Location of Bug

### `generation.worker.ts` - `markCombinationAsUsed()` function (lines 1001-1008)
```typescript
// Old buggy code:
if (!useBitPack) {
    const stringKey = foundTraits.sort().join('|');
    const hashKey = generateCombinationHash(stringKey);
    if (!combinationHashes.has(hashKey)) {
        combinationHashes.set(hashKey, stringKey);
    }
    combinationStats.hashHits++;
}
// ❌ Bug: Not adding to usedSet, only to combinationHashes
```

### `csp-solver.ts` - `isValidCombination()` function (lines 657-666)
```typescript
// Old buggy code:
catch {
    const fallbackKey = traitIds.sort().join('|');
    const stringSet = new Set(
        Array.from(usedSet).map((idx) => CombinationIndexer.unpack(idx).sort().join('|'))
    );
    if (stringSet.has(fallbackKey)) {
        return false;
    }
}
// ❌ Bug: Trying to unpack hash-based bigints as bit-packed data (incorrect)
```

## The Fix

### 1. Updated `markCombinationAsUsed()` in `generation.worker.ts`
Added hash-based combinations to `usedSet` by converting the hash to a bigint:

```typescript
if (!useBitPack) {
    const stringKey = foundTraits.sort().join('|');
    const hashKey = generateCombinationHash(stringKey);
    // ✅ Fix: Convert hash to bigint and add to usedSet
    const hashAsBigInt = BigInt('0x' + hashKey);
    usedSet.add(hashAsBigInt);
    if (!combinationHashes.has(hashKey)) {
        combinationHashes.set(hashKey, stringKey);
    }
    combinationStats.hashHits++;
}
```

### 2. Updated `isValidCombination()` in `csp-solver.ts`
Added `generateHashKey()` method and updated fallback check to use hash-based lookup:

```typescript
catch {
    // ✅ Fix: Use hash-based check instead of unpacking
    const fallbackKey = traitIds.sort().join('|');
    const hashKey = this.generateHashKey(fallbackKey);
    const hashAsBigInt = BigInt('0x' + hashKey);
    
    if (usedSet.has(hashAsBigInt)) {
        return false; // Already used
    }
}
```

### 3. Updated `isCombinationUsed()` in `generation.worker.ts`
Enhanced the check to look for hash-based bigints in usedSet:

```typescript
const combinationKey = foundTraits.sort().join('|');
const hashKey = generateCombinationHash(combinationKey);
const hashAsBigInt = BigInt('0x' + hashKey);

// ✅ Fix: Check both usedSet and combinationHashes
if (usedSet.has(hashAsBigInt) || combinationHashes.has(hashKey)) {
    combinationStats.hashHits++;
    combinationStats.totalChecks++;
    return true;
}
```

## Testing

### Test Case 1: Standard Configuration (≤ 255 trait IDs, ≤ 8 traits)
- **Before**: Working correctly (bit-packed)
- **After**: Still working correctly (bit-packed)

### Test Case 2: Large Trait IDs (> 255) or Many Traits (> 8)
- **Before**: ❌ Duplicates allowed
- **After**: ✅ Duplicates prevented

## Technical Details

### Hash Generation Algorithm
Both worker and CSP solver now use the same hash algorithm:
```typescript
function generateNumericHash(combinationKey: string): number {
    let hash = 0;
    for (let i = 0; i < combinationKey.length; i++) {
        const char = combinationKey.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Make it unsigned to avoid negative values
    return hash >>> 0;
}
```

The numeric hash is converted to a bigint using: `BigInt(numericHash)`

This ensures consistent representation in the `Set<bigint>` structure without hexadecimal conversion issues.

**Important Note:** The initial fix attempted to use `BigInt('0x' + hashKey)` where `hashKey` was a base36 string, but this failed because base36 can contain characters g-z which are invalid in hexadecimal notation. The corrected approach directly converts the numeric hash to BigInt.

## Impact
- ✅ Strict pair configuration now properly prevents duplicate combinations in ALL cases
- ✅ No performance degradation (O(1) hash-based lookup)
- ✅ Backward compatible with existing projects
- ✅ No changes to API or user-facing features

## Files Modified
1. `/src/lib/workers/generation.worker.ts`
   - Added `generateNumericHash()` function
   - Updated `generateCombinationHash()` to use `generateNumericHash()`
   - Updated `markCombinationAsUsed()` function to use numeric hash
   - Updated `isCombinationUsed()` function to use numeric hash

2. `/src/lib/workers/csp-solver.ts`
   - Added `generateNumericHash()` method
   - Updated `isValidCombination()` fallback logic to use numeric hash
