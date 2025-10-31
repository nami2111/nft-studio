# User Guide: Strict Pair Mode

## Overview

Strict Pair Mode is an advanced feature that gives you precise control over the uniqueness of specific trait combinations in your NFT collection. This feature prevents specific trait combinations from appearing more than once, allowing you to create ultra-rare and strategically designed collections.

## Key Concepts

### Multi-Layer Combinations

Unlike simple systems that only track 2 layers, Strict Pair Mode supports unlimited layer combinations, giving you maximum flexibility:

- **2-Layer Example**: BASE + HEAD = 4 × 3 = **12 unique combinations**
- **4-Layer Example**: BASE + HEAD + ACCESSORY + CLOTHING = 4 × 3 × 5 × 6 = **360 unique combinations**

### Uniqueness Tracking

The system automatically tracks all possible trait combinations between selected layers and prevents duplicates during generation, ensuring each combination appears only once in your collection.

## Getting Started

### Step 1: Enable Strict Pair Mode

1. Navigate to your project in the main app interface
2. Scroll down to find the **"Strict Pair Mode"** section in the settings panel
3. Click the **"Enable Strict Pair"** toggle button
4. The feature is now active and ready for configuration

### Step 2: Create Layer Combinations

1. Click the **"Add Layer Combination"** button
2. A modal will appear asking you to select layers
3. Select **2 or more layers** from the available layers list
4. The system will automatically calculate the total unique combinations
5. Add an optional description for better organization
6. Click **"Add Layer Combination"** to save your configuration

### Step 3: Manage Your Combinations

Once created, you can manage your layer combinations:

- **View Statistics**: See the total number of unique combinations being tracked
- **Toggle Active/Inactive**: Enable or disable combinations without deleting them
- **Delete**: Remove combinations you no longer need
- **Info**: View details about the combination and its current status

## Practical Examples

### Example 1: Character + Accessory Pairs

Create 20 unique character-outfit combinations:

```
Layers: CHARACTER (5 traits) + ACCESSORY (4 traits)
Total Combinations: 5 × 4 = 20 unique combinations
Result: Each character-accessory pair appears only once
Use Case: Create 20 unique character outfits with guaranteed uniqueness
```

### Example 2: Multi-Layer Trait Sets

Create highly structured collections with controlled distribution:

```
Layers: BASE (4) + HEAD (3) + ACCESSORY (5) + CLOTHING (6)
Total Combinations: 4 × 3 × 5 × 6 = 360 unique combinations
Result: Each 4-layer combination appears only once
Use Case: Create sophisticated collections with precise trait distribution
```

### Example 3: Ultra-Rare Legendary Items

Create extremely valuable one-of-a-kind combinations:

```
Layers: WEAPON (3) + ARMOR (4) + BACKGROUND (2) + EFFECT (1)
Total Combinations: 3 × 4 × 2 × 1 = 24 unique combinations
Result: 24 legendary combinations, each appearing only once
Use Case: Create collector's items with extreme rarity and value
```

## Use Cases and Strategies

### Ultra-Rare Combinations
- **Goal**: Create legendary combinations that appear only once
- **Strategy**: Use 2-3 layers with small trait counts
- **Result**: Extremely valuable NFTs sought after by collectors

### Thematic Consistency
- **Goal**: Ensure traits match your artistic vision
- **Strategy**: Group related layers (e.g., MEDIEVAL + FANTASY themes)
- **Result**: Cohesive collections without unexpected combinations

### Rarity Engineering
- **Goal**: Control exact rarity distribution
- **Strategy**: Use Strict Pair for ultra-rare, allow normal generation for others
- **Result**: Precise control over collection rarity curve

### Collection Structure
- **Goal**: Create sub-collections within main collection
- **Strategy**: Different trait combinations for different themes
- **Result**: Organized collection with clear categorization

## Best Practices

### Planning Phase
1. **Design Your Strategy**: Decide which combinations should be rare before creating large collections
2. **Calculate Impact**: Understand how many combinations will be tracked (traits_in_layer1 × traits_in_layer2 × ...)
3. **Test Small**: Run small test generations (10-50 NFTs) to verify behavior

### Configuration Phase
1. **Start Simple**: Begin with 2-3 layer combinations
2. **Add Descriptions**: Document the purpose of each combination
3. **Monitor Progress**: Watch generation to ensure system works correctly

### Generation Phase
1. **Balance Rarity**: Use Strict Pair for ultra-rare, allow normal generation for common traits
2. **Monitor Memory**: Large combinations may use more memory during generation
3. **Review Results**: Check generated collection to ensure uniqueness constraints worked

## Advanced Features

### Multiple Active Combinations
You can create multiple layer combinations simultaneously:

```
Combination 1: BASE + HEAD = 12 unique combinations
Combination 2: CHARACTER + ACCESSORY = 20 unique combinations
Combination 3: BACKGROUND + EFFECT = 8 unique combinations
Total: 40 unique constraints across different layer pairs
```

### Active/Inactive Management
- **Active**: Currently tracking and preventing duplicates
- **Inactive**: Configured but not affecting current generation
- **Use Case**: Prepare combinations in advance, activate when needed

### Automatic Retry Logic
When duplicates are detected:
1. System automatically identifies the violation
2. Generation retries with different trait combinations
3. Process continues until all valid combinations are generated

## Technical Implementation

### Worker-Level Tracking
- Duplicate prevention happens at the worker level for maximum performance
- Ensures consistent results across all generation processes
- Maintains tracking state across large generation jobs

### Memory Management
- Used combinations are tracked efficiently
- Automatic cleanup prevents memory issues
- Supports large collections (10,000+ NFTs)

### Persistent Configuration
- Your Strict Pair settings are saved with your project
- Configurations persist across browser sessions
- Easy to modify and extend as your project evolves

## Troubleshooting

### Generation Takes Longer Than Expected
**Issue**: Strict Pair Mode may increase generation time due to duplicate prevention
**Solution**: This is normal behavior. The system is working correctly to ensure uniqueness.

### Not Seeing Expected Uniqueness
**Issue**: Combinations still appearing multiple times
**Solution**:
1. Verify Strict Pair Mode is enabled
2. Check that the correct layers are selected
3. Ensure the combination is marked as active
4. Run a small test generation to verify

### Memory Issues with Large Combinations
**Issue**: Browser becomes slow during generation
**Solution**:
1. Use fewer layers or traits per combination
2. Generate in smaller batches
3. Close other browser tabs to free memory

### Can't Select Layers
**Issue**: Layer selection disabled or grayed out
**Solution**:
1. Ensure you have at least 2 layers with traits
2. Check that layers have uploaded trait images
3. Verify layers are properly configured in the project

## Tips and Tricks

### Pro Tip: Strategic Layer Selection
Choose layers with complementary trait counts:
- **Balanced**: Similar number of traits per layer (e.g., 4 × 4 = 16 combos)
- **Focused**: One layer with few traits, others with many (e.g., 1 × 20 = 20 combos)

### Pro Tip: Combination Naming
Use descriptive names for easy management:
- "Legendary Weapons" (WEAPON + EFFECT)
- "Royal Outfits" (CLOTHING + ACCESSORY + CROWN)
- "Nature Themes" (BACKGROUND + CHARACTER + ACCESSORY)

### Pro Tip: Progressive Complexity
Start simple and add complexity:
1. **Phase 1**: Basic 2-layer combinations
2. **Phase 2**: Add 3-layer combinations
3. **Phase 3**: Complex 4+ layer combinations

### Pro Tip: Testing Strategy
Always test with small collections first:
1. Create test project with 2-3 traits per layer
2. Generate 10-20 NFTs
3. Verify uniqueness constraints work
4. Scale up to full project size

## Integration with Other Features

### Working with Ruler Traits
- **Strict Pair**: Controls uniqueness of specific combinations
- **Ruler Traits**: Controls which combinations are allowed
- **Combined Use**: Create complex rule systems with both constraints

### Gallery Mode Viewing
- Generated collections show all NFTs with unique combinations
- Interactive filtering works with Strict Pair combinations
- Rarity calculations include Strict Pair constraints

### Import/Export
- Strict Pair configurations saved with project files
- Imported projects maintain Strict Pair settings
- Export preserves all uniqueness constraints

## Frequently Asked Questions

**Q: Can I use Strict Pair Mode with Ruler Traits?**
A: Yes! Both features can work together. Ruler Traits control allowed combinations, while Strict Pair ensures uniqueness.

**Q: What happens to already generated NFTs if I change Strict Pair settings?**
A: Existing NFTs are not affected. Changes only apply to new generation runs.

**Q: Can I track the same layers in multiple combinations?**
A: Yes! You can create multiple combinations with overlapping layers (e.g., BASE+HEAD and BASE+ACCESSORY).

**Q: Is there a limit to how many combinations I can create?**
A: No practical limit, but each combination adds complexity to the generation process.

**Q: Does Strict Pair Mode work with all image formats?**
A: Yes, it works with any supported image format (PNG, JPG, GIF, WebP, etc.).

## Examples and Templates

### Template 1: Simple Character Collection
```
Layers: BODY (5) + HAIR (4) + EYES (3)
Combinations: 5 × 4 × 3 = 60 unique character appearances
Purpose: Ensure each character combination is unique
```

### Template 2: Accessory Focused Collection
```
Layers: BASE (8) + ACCESSORY (6)
Combinations: 8 × 6 = 48 unique outfit combinations
Purpose: Create diverse accessory combinations
```

### Template 3: Ultra-Rare Legendary Items
```
Layers: LEGENDARY_WEAPON (2) + MYTHICAL_ARMOR (3) + DIVINE_BACKGROUND (1)
Combinations: 2 × 3 × 1 = 6 ultra-rare legendary sets
Purpose: Create extremely valuable collector's items
```

## Conclusion

Strict Pair Mode is a powerful tool for creating unique and strategically designed NFT collections. By understanding how multi-layer combinations work and following best practices, you can create collections with precise control over trait uniqueness and rarity distribution.

Start simple, test thoroughly, and gradually build complexity as you become more familiar with the feature. The flexibility of unlimited layer combinations makes it suitable for everything from simple character collections to complex, multi-layered artistic visions.