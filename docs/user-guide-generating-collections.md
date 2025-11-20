# User Guide: Generating NFT Collections

This guide covers the process of generating complete NFT collections from your configured layers and traits.

## Overview

NFT Studio uses advanced generation algorithms to create unique NFT combinations based on your layer configuration and rarity settings. The system supports both small collections and large-scale generation with performance optimizations.

## Generation Process

### 1. Preparation

Before generating your collection:

1. **Complete layer setup** with all traits uploaded
2. **Set project dimensions** in project settings
3. **Configure rarity weights** for all traits
4. **Verify preview functionality** with test generations

### 2. Generation Settings

Access the custom generation modal to configure your collection:

#### Collection Size

- **Small collections**: 1-100 NFTs
- **Medium collections**: 101-1,000 NFTs
- **Large collections**: 1,001-10,000 NFTs (maximum supported)

> **Note**: The generation process automatically optimizes performance based on your device capabilities. All settings like chunk size, memory usage, and preview frequency are handled automatically.

### 3. Starting Generation

1. **Click "Generate Collection"** in the main interface
2. **Review settings** in the custom generation modal
3. **Set collection size** based on your needs
4. **Click "Start Generation"** to begin the process

## Generation Process

The system automatically selects the optimal generation method based on your collection size and device capabilities:

### Automatic Optimization

- **All collections**: Uses optimized Canvas API with adaptive chunking and memory management
- **Memory management**: Real-time monitoring with adaptive chunk sizing
- **Performance tuning**: Automatic optimization based on device capabilities

### Canvas Optimization

NFT Studio uses the Canvas API optimized for all collection sizes:

- **Automatic optimization**: Adaptive chunking and ImageBitmap for memory efficiency
- **Performance benefits**: Smooth generation for collections up to 10,000 items
- **Progressive processing**: Real-time previews and progress updates
- **Memory efficiency**: Garbage collection and resource cleanup between chunks

## Monitoring Progress

During generation, you can monitor:

### Progress Indicators

- **Completion percentage** and item count
- **Estimated time remaining**
- **Memory usage** and system resources
- **Current processing chunk**

### Real-time Previews

- **Individual NFT previews** every 100 items (for large collections)
- **Quality verification** during generation
- **Distribution sampling** to check rarity balance

### Performance Metrics

- **Processing speed** (items per second)
- **Memory consumption** with automatic optimization
- **Worker utilization** across available CPU cores

## Generation Results

### Output Structure

Generated collections include:

```
collection_export/
├── images/
│   ├── 1.png
│   ├── 2.png
│   └── ...
├── metadata/
│   ├── 1.json
│   ├── 2.json
│   └── ...
└── project_config.json
```

### Metadata Format

Each NFT includes standard metadata:

```json
{
	"name": "My Collection #1",
	"description": "A unique NFT from My Collection",
	"image": "1.png",
	"attributes": [
		{
			"trait_type": "Background",
			"value": "Blue Sky"
		},
		{
			"trait_type": "Character",
			"value": "Robot"
		}
	]
}
```

## Advanced Features

### Automatic Quality Control

The system includes built-in validation to ensure generation quality:

- **Project validation**: Checks for missing images and invalid configurations
- **Memory optimization**: Real-time memory monitoring with adaptive chunk sizing
- **Error recovery**: Graceful handling of processing errors with fallback mechanisms

### Progressive Generation

For large collections:

- **Chunked processing**: Automatic division into manageable chunks
- **Memory monitoring**: Real-time memory usage tracking and optimization
- **Preview generation**: Progressive previews during long-running generations

## Performance Optimization

### Collection Size Considerations

| Size         | Recommended Approach   | Estimated Time |
| ------------ | ---------------------- | -------------- |
| 1-100        | Standard generation    | < 1 minute     |
| 101-1,000    | Optimized chunking     | 1-5 minutes    |
| 1,001-10,000 | Canvas acceleration    | 5-30 minutes   |
| 10,000+      | Progressive generation | 30+ minutes    |

### Memory Management

- **Automatic chunk sizing** based on available memory
- **Garbage collection** between processing chunks
- **Object URL cleanup** to prevent memory leaks
- **Worker pool optimization** for multi-core systems

### Browser Recommendations

- **Chrome/Edge**: Best performance with full Web Worker support
- **Firefox**: Good performance with optimized memory usage
- **Safari**: Compatible with standard generation features

## Troubleshooting

### Common Issues

#### Generation Too Slow

- **Close other browser tabs** to free up system resources
- **Reduce collection size** and generate in batches
- **Use optimized Canvas** for all collections
- **Check browser performance** settings

#### Memory Errors

- **Reduce chunk size** in performance settings
- **Clear browser cache** before large generations
- **Use progressive preview** to reduce memory usage
- **Restart browser** if memory issues persist

#### Generation Failures

- **Verify all traits** have valid image data
- **Check layer configuration** for missing traits
- **Validate project dimensions** are set correctly
- **Review browser console** for error messages

### Recovery Options

- **Resume generation** from last completed chunk
- **Export partial results** if generation is interrupted
- **Save project state** before starting large generations
- **Use auto-save feature** for project recovery

## Best Practices

### Pre-Generation Checklist

- [ ] All layers have at least one trait
- [ ] Project dimensions are set correctly
- [ ] Rarity weights are configured as desired
- [ ] Test generation with small batch works
- [ ] Sufficient system resources available

### Performance Tips

- **Generate during off-peak hours** for large collections
- **Use desktop browsers** for better performance
- **Close unnecessary applications** during generation
- **Monitor system resources** during processing

### Quality Assurance

- **Review preview samples** during generation
- **Check metadata accuracy** in sample files
- **Verify image quality** meets your standards
- **Test rarity distribution** matches expectations

## Export Options

After successful generation:

1. **Download as ZIP** - Complete collection packaged as a ZIP file containing:
   - `images/` folder with all generated NFT images (PNG format)
   - `metadata/` folder with JSON metadata files
   - Standard NFT metadata format compatible with most marketplaces

> **Note**: Currently, only ZIP export is supported. The system automatically packages your complete collection with proper folder structure and metadata.

## Related Documentation

- [Adding Traits](./user-guide-adding-traits.md)
- [Project Management](../README.md#project-management)
- [Export Options](../README.md#export-options)
- [Performance Optimization](../README.md#performance-optimizations)
