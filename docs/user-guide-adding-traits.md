# User Guide: Adding Traits to Your NFT Collection

This guide will walk you through the process of adding traits to your NFT collection in NFT Studio.

## Overview

Traits are the individual images that make up your NFT layers. Each trait belongs to a specific layer (e.g., Background, Character, Accessories) and can have different rarity weights to control how often they appear in your generated collection.

## Step-by-Step Guide

### 1. Create or Load a Project

Before adding traits, you need to have a project with at least one layer:

1. **Create a new project**:
   - Click "New Project" on the welcome screen
   - Enter a project name and description
   - Set your desired output dimensions (width and height in pixels)

2. **Load an existing project**:
   - Click "Load Project" and select your project ZIP file
   - Or use the auto-saved project from local storage

### 2. Add Layers

If your project doesn't have layers yet:

1. **Click "Add Layer"** in the Layer Manager
2. **Configure the layer**:
   - **Name**: Descriptive name (e.g., "Background", "Character", "Accessories")
   - **Order**: Layer stacking order (lower numbers render first)
   - **Optional**: Check if this layer can be skipped in some NFTs

3. **Repeat** for all layers in your collection

### 3. Add Traits to Layers

For each layer, you can add multiple traits:

#### Adding a Single Trait

1. **Select the layer** you want to add traits to
2. **Click "Add Trait"** or drag and drop an image file
3. **Configure the trait**:
   - **Name**: Descriptive name for the trait
   - **Rarity Weight**: How common this trait should be (1-5):
     - **1 (Common)**: Appears frequently
     - **2 (Uncommon)**: Appears regularly
     - **3 (Epic)**: Appears occasionally
     - **4 (Rare)**: Appears infrequently
     - **5 (Legendary)**: Appears very rarely
   - **Image**: Upload the trait image file

#### Supported Image Formats

- **PNG** (recommended for transparency)
- **JPG/JPEG** (for opaque images)
- **Maximum file size**: 10MB per trait
- **Recommended dimensions**: Match your project output size

> **Note**: The first image uploaded automatically sets the project output dimensions. All subsequent traits will be scaled to match these dimensions during generation.

### 4. Configure Rarity Distribution

After adding traits, you can fine-tune rarity:

1. **Use the rarity slider** for each trait
2. **Monitor the distribution** in the preview panel
3. **Test generation** with a small batch to verify distribution

### 5. Preview and Validate

Before generating your full collection:

1. **Check the preview panel** to see how traits combine
2. **Verify layer order** - traits render from bottom to top
3. **Test individual NFTs** by clicking "Generate Preview"

## Best Practices

### Image Preparation

- **Use consistent dimensions** for all traits in a layer
- **PNG with transparency** for layers that need to overlay others
- **Optimize file sizes** without sacrificing quality
- **Test image loading** in the preview before batch generation

### Rarity Strategy

- **Balance your collection** with a mix of common and rare traits
- **Consider trait combinations** - some traits might not work well together
- **Test small batches** to verify your rarity distribution
- **Use optional layers** for traits that shouldn't appear in every NFT

### Organization

- **Use descriptive names** for layers and traits
- **Group related traits** in the same layer
- **Maintain consistent naming** conventions
- **Document your trait system** for future reference

## Common Issues and Solutions

### Image Loading Problems

- **File too large**: Compress images to under 10MB
- **Wrong format**: Convert to PNG or JPG
- **Corrupted file**: Try re-exporting from your image editor

### Rarity Distribution Issues

- **Too many legendaries**: Consider making some traits more common
- **Missing combinations**: Add more trait variety
- **Unbalanced distribution**: Adjust rarity weights

### Performance Tips

- **Optimize image dimensions** to match output size
- **Limit trait count** per layer for better performance
- **Use PNG format** for best quality and transparency support
- **Keep file sizes reasonable** for faster loading and processing

## Advanced Features

### Ruler Traits (Advanced Control)

Ruler traits provide sophisticated control over which trait combinations can be generated. This advanced feature allows you to enforce specific compatibility rules.

#### What Are Ruler Traits?

- **Normal Traits**: Can combine with any other trait freely
- **Ruler Traits**: Act as compatibility rules that control which other traits can appear together

#### Creating Ruler Traits

1. **Convert Existing Trait**: Click the crown icon (👑) in the top-right corner of any trait card
2. **Configure Rules**: Click the settings (⚙️) icon that appears for ruler traits
3. **Set Permissions**: Choose which traits from other layers are allowed or forbidden

#### Rule Configuration

For each ruler trait, you can:

- **Control Multiple Layers**: One ruler can control multiple different layers
- **Set Allowed Traits**: Green badges = traits that CAN appear together
- **Set Forbidden Traits**: Red badges = traits that CANNOT appear together
- **Add Multiple Rules**: Create complex rule systems for sophisticated combinations

#### Common Use Cases

- **Thematic Collections**: Forest backgrounds only with nature accessories
- **Ultra-Rare Combinations**: Golden crown only with royal accessories
- **Narrative Logic**: Character backgrounds determine available equipment
- **Sub-Collections**: Create themed groups within your collection

#### Visual Indicators

- **Crown Icon**: Toggle between normal and ruler trait types
- **Highlighted Crown**: Active ruler trait status
- **Settings Icon**: Accessible only for ruler traits (⚙️)
- **Color Badges**: Green (allowed) and red (forbidden) trait indicators

### Optional Layers

Mark a layer as optional to allow some NFTs to skip it entirely. This creates more variety in your collection.

### Custom Rarity Weights

While the default is 1-5, you can use any positive integer for more granular control over rarity distribution.

### Image Security

All uploaded images undergo security validation to prevent malicious content and ensure safe processing.

## Next Steps

After adding all your traits:

1. [Generate your NFT collection](./user-guide-generating-collections.md)
2. [Export your project](../README.md#export-options)
3. [Manage your project settings](../README.md#project-management)

## Related Documentation

- [Generating Collections](./user-guide-generating-collections.md)
- [Project Management](../README.md#project-management)
- [Layer Management](../README.md#layer-management)
- [Export Options](../README.md#export-options)
