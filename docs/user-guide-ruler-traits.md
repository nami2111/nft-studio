# User Guide: Ruler Traits

Ruler traits provide advanced control over trait compatibility during NFT generation. This guide covers how to create, configure, and use ruler traits to enforce specific trait combinations and create sophisticated collection structures.

## Overview

Ruler traits are special traits that act as compatibility rules for your NFT collections. Instead of allowing random combinations, ruler traits ensure that only specific trait combinations are generated, enabling you to:

- **Enforce thematic consistency** (e.g., forest backgrounds with nature accessories)
- **Create ultra-rare combinations** (specific trait pairings)
- **Build narrative logic** (story-based trait relationships)
- **Design collection structures** (sub-collections with shared themes)

## What Are Ruler Traits?

Normal traits allow any combination during generation. Ruler traits add a layer of control:

- **Normal Trait**: Can combine with any other trait
- **Ruler Trait**: Acts as a rule that controls which other traits can appear together

### How Ruler Traits Work

1. **Selection Control**: When a ruler trait is selected, only traits that pass its rules can be selected from other layers
2. **Generation Rules**: During NFT generation, the system checks all selected traits against ruler trait rules
3. **Compatibility Validation**: Forbidden combinations are rejected, and only valid combinations are generated

## Creating Ruler Traits

### Converting Existing Traits

1. **Navigate** to your project's trait layers
2. **Locate** the trait you want to make a ruler
3. **Click the Crown Icon** (👑) in the top-right corner of the trait card
4. **Confirmation**: The trait is converted to ruler type (crown icon becomes highlighted)
5. **Configure Rules**: Click the settings (⚙️) icon that appears next to ruler traits

### Visual Indicators

- **Crown Icon**: Click to toggle between normal and ruler trait types
- **Highlighted Crown**: Active ruler trait
- **Settings Icon**: Appears only for ruler traits, click to manage compatibility rules
- **Green Badges**: Allowed traits in rule configuration
- **Red Badges**: Forbidden traits in rule configuration

## Configuring Compatibility Rules

### Rule Management Interface

1. **Access Rules**: Click the settings (⚙️) icon on any ruler trait
2. **Select Target Layer**: Choose which layer's traits you want to control
3. **Set Permissions**: Click traits to mark them as allowed or forbidden
4. **Save Rule**: Click "Add Rule" to save your configuration

### Rule Types

**Allowed Traits** (Green Badges):
- These traits CAN appear when the ruler trait is selected
- All other traits in the layer are forbidden by default

**Forbidden Traits** (Red Badges):
- These traits CANNOT appear when the ruler trait is selected
- Explicitly blocks specific trait combinations

### Multiple Rules per Ruler

You can create multiple compatibility rules for the same ruler trait:
- **Cross-Layer Control**: One ruler can control multiple different layers
- **Complex Logic**: Build sophisticated trait relationship systems
- **Fine-Grained Control**: Precise control over trait combinations

## Practical Examples

### Example 1: Thematic Consistency

**Scenario**: Forest backgrounds should only work with nature-themed accessories

**Ruler Trait**: "Forest Background" (Background layer)
**Rules for Accessories Layer**:
- **Allowed**: Tree, Leaf, Mushroom, Flower, Animal
- **Forbidden**: Metal, Tech, Urban, Neon

**Result**: Only nature-themed accessories appear with forest backgrounds

### Example 2: Ultra-Rare Combinations

**Scenario**: Create extremely rare trait combinations

**Ruler Trait**: "Golden Crown" (Head layer)
**Rules for Accessories Layer**:
- **Allowed**: Royal Scepter, Magic Wand
- **Forbidden**: All other accessories

**Result**: Only royal accessories appear with golden crowns, creating ultra-rare NFTs

### Example 3: Narrative Collections

**Scenario**: Character backgrounds determine available equipment

**Ruler Traits**:
- "Ninja Village" (Background layer)
- "Wizard Tower" (Background layer)
- "Dragon Lair" (Background layer)

**Rules for Accessories Layer**:
- **Ninja Village Rules**: Shuriken, Kunai, Smoke Bomb allowed
- **Wizard Tower Rules**: Staff, Spellbook, Potion allowed
- **Dragon Lair Rules**: Sword, Shield, Treasure allowed

**Result**: Each background type has appropriate thematic equipment

## Best Practices

### Planning Your Ruler System

1. **Design Before Importing**: Plan ruler logic before importing large numbers of traits
2. **Start Simple**: Begin with basic ruler rules and gradually add complexity
3. **Test Combinations**: Use the preview feature to verify compatibility rules work as expected
4. **Document Rules**: Keep track of your ruler logic for future reference

### Rule Design Principles

- **Clear Logic**: Rules should have obvious thematic or narrative reasons
- **Avoid Over-Constraint**: Don't make rules too restrictive unless intentional
- **Test Edge Cases**: Verify rare trait combinations work as expected
- **Maintain Balance**: Ensure enough valid combinations remain for good variety

### Common Patterns

**Background-Driven Rules**: Most common pattern, backgrounds control accessories
- Pros: Easy to understand, creates clear themes
- Cons: Limited to background layer influence

**Character-Driven Rules**: Character traits control accessories
- Pros: More flexible, enables character-based storytelling
- Cons: More complex to manage multiple character types

**Cross-Layer Rules**: Multiple rulers controlling different layers
- Pros: Maximum flexibility, sophisticated combinations
- Cons: Complex to debug, requires careful planning

## Using Ruler Traits in Generation

### Generation Workflow

1. **Select Layers**: Choose your background, character, and other layers as normal
2. **Apply Ruler Rules**: The system automatically filters available traits based on active rulers
3. **Real-Time Preview**: Preview shows only valid trait combinations
4. **Generate Collection**: Generate with confidence that rules will be enforced

### Preview Validation

The preview system automatically:
- **Filters Options**: Shows only compatible trait combinations
- **Highlights Conflicts**: Displays warnings about incompatible selections
- **Updates in Real-Time**: Changes to ruler rules immediately affect available options

## Advanced Features

### Rule Conflicts Management

The system handles complex rule scenarios:

- **Multiple Active Rulers**: When multiple ruler traits are selected, all rules apply
- **Conflicting Rules**: System prevents and warns about contradictory rules
- **Rule Inheritance**: Rules are maintained during project operations

### Export and Import

Ruler trait settings are preserved when:
- **Exporting Projects**: Rules are included in ZIP export files
- **Importing Projects**: Ruler configurations are restored
- **Saving Projects**: All ruler settings are saved to browser storage

### Bulk Operations

- **Apply to Multiple Traits**: Use ruler rules with bulk trait operations
- **Copy Rules**: Duplicate ruler configurations across similar traits
- **Template Creation**: Save ruler rule sets as templates for future projects

## Troubleshooting

### Common Issues

**No Traits Available After Selecting Ruler**:
- Check if ruler rules are configured correctly
- Ensure some traits are marked as "allowed" in the target layer
- Verify the ruler trait is actually selected in the layer

**Generation Takes Too Long**:
- Complex ruler rules may slow down generation
- Consider simplifying rule logic
- Test with smaller collection sizes first

**Unexpected Trait Combinations**:
- Review all active ruler rules for conflicts
- Check if multiple rulers are creating contradictory requirements
- Use preview mode to test rule effectiveness

**Rules Not Applying**:
- Verify trait type is set to "ruler" (check crown icon)
- Ensure rules are saved (click "Add Rule" button)
- Refresh the project to reload rule configurations

### Debugging Tips

1. **Use Preview Mode**: Test rule combinations before full generation
2. **Check Visual Indicators**: Look for green/red badges on trait cards
3. **Review Rule Details**: Examine specific ruler rule configurations
4. **Test Incrementally**: Add rules one at a time to identify issues

## Technical Details

### Rule Structure

Each ruler rule contains:
- **Layer ID**: Which layer the rule controls
- **Allowed Traits**: List of trait IDs that are permitted
- **Forbidden Traits**: List of trait IDs that are blocked
- **Rule Priority**: Order of evaluation when multiple rules apply

### Performance Considerations

- **Rule Evaluation**: Rules are checked during generation for each NFT
- **Memory Usage**: Rule data is stored efficiently in browser storage
- **Caching**: Rule results are cached for improved preview performance
- **Scalability**: System handles hundreds of rules across multiple layers

### Data Format

Ruler traits store rules in a structured format:
```typescript
interface RulerRule {
  layerId: string;
  allowedTraits: string[];
  forbiddenTraits: string[];
}
```

This format enables:
- **Efficient Storage**: Compact representation in browser storage
- **Fast Lookups**: Quick rule evaluation during generation
- **Easy Migration**: Compatible with project export/import
- **Flexible Configuration**: Dynamic rule management

## Integration with Other Features

### Rarity Calculation

Ruler traits work seamlessly with the rarity system:
- **Normal Rarity**: Ruler traits have their own rarity like any other trait
- **Rarity Impact**: Ruler rules affect the statistical distribution of traits
- **Score Calculation**: Ruler trait scores included in overall NFT rarity scores

### Bulk Operations

- **Bulk Editing**: Apply ruler rules to multiple traits simultaneously
- **Bulk Import**: Import projects with pre-configured ruler systems
- **Copy/Paste**: Duplicate ruler configurations between similar traits

### File Operations

- **Project Save**: All ruler configurations included in saved projects
- **ZIP Export**: Ruler rules preserved in exported collection files
- **Project Load**: Automatically restores ruler settings from saved files

## Tips and Best Practices

### Design Strategies

1. **Theme-First Approach**: Plan your collection themes before implementing rules
2. **Modular Design**: Create reusable ruler rule patterns
3. **Progressive Complexity**: Start simple and add complexity gradually
4. **User Experience**: Ensure enough variety for engaging collections

### Rule Management

1. **Document Decisions**: Write down the reasoning behind each ruler rule
2. **Test Thoroughly**: Use preview mode extensively before full generation
3. **Backup Regularly**: Save project versions to preserve ruler configurations
4. **Review Periodically**: Reassess rule effectiveness after initial generation

### Performance Optimization

1. **Rule Simplification**: Keep rules as simple as possible while maintaining effectiveness
2. **Layer Organization**: Group related rules in the same layers when possible
3. **Rule Cleanup**: Remove unused or conflicting rules periodically
4. **Testing Strategy**: Test ruler combinations in manageable batches

## Conclusion

Ruler traits provide powerful control over NFT generation, enabling you to create sophisticated, themed, and narratively-driven collections. By understanding how to effectively configure and manage ruler rules, you can achieve precise control over trait combinations while maintaining good generation performance.

Start with simple concepts and gradually build more complex rule systems as you become more familiar with the interface and capabilities. The preview system provides immediate feedback on rule effectiveness, making it easy to iterate and refine your ruler trait strategies.