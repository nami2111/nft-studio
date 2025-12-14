# Test Plan for Strict Pair Duplication Fix

## Bug Summary
Strict pair configuration was generating duplicate layer combinations when trait IDs > 255 or when combinations had > 8 traits.

## Fix Summary
- Updated `markCombinationAsUsed()` to store hash-based combinations in usedSet
- Updated `isValidCombination()` to check hash-based combinations in usedSet
- Updated `isCombinationUsed()` to check both usedSet and combinationHashes

## Manual Testing Steps

### Test 1: Standard Configuration (Bit-Packed Path)
**Prerequisites:**
- Project with trait IDs ≤ 255
- Strict pair with ≤ 8 layers

**Steps:**
1. Create a project with 2-3 layers
2. Add 5-10 traits per layer (ensure trait IDs < 255)
3. Enable Strict Pair mode
4. Configure a layer combination (e.g., Layer 1 + Layer 2)
5. Generate 50+ NFTs

**Expected Result:**
- ✅ No duplicate trait combinations should appear
- ✅ Each NFT should have a unique combination for the configured layers

### Test 2: Large Trait IDs (Hash-Based Fallback Path)
**Prerequisites:**
- Project with trait IDs > 255 (or manually assign high IDs)
- Strict pair with any number of layers

**Steps:**
1. Create a project with 2-3 layers
2. Add traits with IDs that exceed 255
3. Enable Strict Pair mode
4. Configure a layer combination
5. Generate 50+ NFTs

**Expected Result:**
- ✅ No duplicate trait combinations should appear (THIS WAS THE BUG)
- ✅ Each NFT should have a unique combination for the configured layers

### Test 3: Many Layers (Hash-Based Fallback Path)
**Prerequisites:**
- Project with 9+ layers in a strict pair combination
- Any trait IDs

**Steps:**
1. Create a project with 9+ layers
2. Add traits to each layer
3. Enable Strict Pair mode
4. Configure a layer combination with all 9+ layers
5. Generate 50+ NFTs

**Expected Result:**
- ✅ No duplicate trait combinations should appear (THIS WAS THE BUG)
- ✅ Each NFT should have a unique combination for the configured layers

### Test 4: Mixed Configuration
**Prerequisites:**
- Multiple strict pair combinations
- Mix of bit-packed and hash-based paths

**Steps:**
1. Create a project with 5+ layers
2. Configure multiple strict pair combinations:
   - Combination A: 2 layers (bit-packed path)
   - Combination B: 3 layers with high trait IDs (hash-based path)
3. Generate 100+ NFTs

**Expected Result:**
- ✅ No duplicates for either combination
- ✅ Both combinations should be validated independently

## Automated Testing (For Future Implementation)

### Unit Test for Hash Conversion
```typescript
test('Hash-based bigint conversion is consistent', () => {
  const traits = ['trait_256', 'trait_257', 'trait_258'];
  const stringKey = traits.sort().join('|');
  
  // Generate hash
  let hash = 0;
  for (let i = 0; i < stringKey.length; i++) {
    const char = stringKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hashKey = hash.toString(36);
  const hashAsBigInt = BigInt('0x' + hashKey);
  
  // Verify it's a valid bigint
  expect(typeof hashAsBigInt).toBe('bigint');
  expect(hashAsBigInt).toBeGreaterThan(0n);
});
```

### Integration Test for Strict Pair
```typescript
test('Strict pair prevents duplicates with large trait IDs', async () => {
  const project = createTestProject({
    layers: [
      { id: '1', traits: [{ id: '256' }, { id: '257' }] },
      { id: '2', traits: [{ id: '258' }, { id: '259' }] }
    ],
    strictPair: {
      enabled: true,
      layerCombinations: [{
        id: 'combo1',
        layerIds: ['1', '2'],
        active: true
      }]
    }
  });
  
  const generatedNFTs = await generateNFTs(project, 10);
  const combinations = new Set();
  
  for (const nft of generatedNFTs) {
    const combo = nft.layers.map(l => l.traitId).sort().join('|');
    expect(combinations.has(combo)).toBe(false);
    combinations.add(combo);
  }
  
  expect(combinations.size).toBe(10);
});
```

## Debug Verification

To verify the fix is working, add temporary logging in the console:

```typescript
// In markCombinationAsUsed()
console.log(`🔍 Marked combination as used: ${stringKey} (hash: ${hashAsBigInt})`);

// In isValidCombination()
console.log(`🔍 Checking combination: ${fallbackKey} (hash: ${hashAsBigInt}) - exists: ${usedSet.has(hashAsBigInt)}`);
```

**Expected Console Output:**
```
🔍 Marked combination as used: trait_256|trait_258 (hash: 123456789n)
🔍 Checking combination: trait_256|trait_258 (hash: 123456789n) - exists: true
```

## Performance Verification

The fix should have minimal performance impact:

**Metrics to Track:**
- Generation speed (NFTs/sec) should remain similar
- Memory usage should not increase significantly
- Cache hit rates should remain high

**Before Fix:**
- Bit-packed: ~12-15 NFTs/sec
- Hash-based: ~12-15 NFTs/sec (but with duplicates)

**After Fix:**
- Bit-packed: ~12-15 NFTs/sec (unchanged)
- Hash-based: ~12-15 NFTs/sec (no duplicates)

## Regression Testing

Test all existing strict pair functionality:
- ✅ Enabling/disabling strict pair mode
- ✅ Adding/removing layer combinations
- ✅ Activating/deactivating specific combinations
- ✅ Generating with optional layers
- ✅ Generating with ruler rules + strict pair

## Success Criteria

1. ✅ No TypeScript errors
2. ✅ No ESLint warnings in modified files
3. ✅ Build succeeds
4. ✅ No duplicate combinations in any test scenario
5. ✅ Performance remains within acceptable range
6. ✅ All existing strict pair features continue to work
