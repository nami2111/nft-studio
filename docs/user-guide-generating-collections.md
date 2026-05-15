# User Guide: Generating Item Collections

This guide covers the process of generating complete item collections from your configured layers and traits.

## Overview

GNStudio uses advanced generation algorithms to create unique item combinations based on your layer configuration and rarity settings. The system supports both small collections and large-scale generation with performance optimizations.

## Metadata Standards

GNStudio supports multiple metadata standards for different blockchain ecosystems. Select the appropriate standard in Project Settings before starting generation.

### ERC-721 (EVM Marketplaces)

The ERC-721 standard includes these additional metadata fields:

- `external_url` — Link to an external page for the item
- `animation_url` — URL for animated/multimedia content
- `youtube_url` — YouTube video link
- `background_color` — Background color for the item display

### Solana (Metaplex)

The Solana Metaplex standard includes these additional fields:

- `symbol` — Token symbol for the collection
- `seller_fee_basis_points` — Royalty percentage (e.g. 500 = 5%)
- `creators` — Array of creator addresses with share percentages
- `collection` — Collection-level info (name, family)
- `properties.files` — Array of file objects with URIs and types

Configure your chosen standard in **Project Settings → Metadata Standard** before generation.

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

- **Small collections**: 1-100 items
- **Medium collections**: 101-1,000 items
- **Large collections**: 1,001-10,000 items (maximum supported)

> **Note**: The generation process automatically optimizes performance based on your device capabilities. All settings like chunk size, memory usage, and preview frequency are handled automatically.

## CSP Solver

GNStudio uses a Constraint Satisfaction Problem (CSP) solver to generate unique trait combinations while respecting rarity weights and trait constraints.

### Algorithm Components

- **AC-3 Arc Consistency**: Prunes incompatible trait domains by removing trait values that violate constraints. Achieves a 60-80% reduction in the search space before assigning traits.
- **MRV Heuristic**: Minimum Remaining Values heuristic selects the most constrained layer first — the layer with the fewest remaining valid trait options — reducing backtracking.
- **Efraimidis-Spirakis Weighted Random**: Respects trait rarity weights during random selection, ensuring rare traits appear at their configured frequency.
- **Trail-Based Backtracking**: Efficiently retries from dead ends by tracking assignment decisions along a trail, rewinding only to the most recent conflicting layer.

### Constraint Integration

- **Strict Pair constraints**: Ensures specific trait combinations always (or never) appear together
- **Ruler Trait constraints**: Limits how often a trait can appear across the collection (e.g., always, once, or a custom limit)

The CSP solver guarantees every generated item has a unique trait combination, preventing duplicates even in large collections.

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

## Export Strategies

GNStudio provides multiple export strategies optimized for different collection sizes:

### Standard ZIP

- **Best for**: Collections up to 1,000 items
- **Library**: JSZip for in-browser ZIP creation
- **Behavior**: Generates a single ZIP file containing all images and metadata

### Optimized ZIP

- **Best for**: 1,000–3,000 items
- **Approach**: Chunked processing of 100 items per chunk
- **Behavior**: Processes items in batches to avoid memory pressure, then assembles a single ZIP

### Multi-ZIP Export

- **Best for**: 3,001–10,000 items
- **Approach**: Splits output into multiple ZIP files (1 GB max each)
- **Behavior**: Items are distributed across ZIP files with a manifest for reassembly

### Streaming Export

- **Behavior**: Images stream directly to IndexedDB during generation
- **Benefit**: Reduces peak memory usage by persisting images as they are rendered
- **Compatible with**: IndexedDB-enabled browsers

### Worker-Offloaded ZIP

- **Best for**: Collections with more than 500 items
- **Behavior**: ZIP creation runs in a dedicated Web Worker
- **Benefit**: Keeps the main thread responsive during compression

## Feature Flags

GNStudio exposes feature flags to fine-tune the generation pipeline:

| Flag                        | Description                                                                                             | Default  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `enableStreamingStorage`    | Streams generated images to IndexedDB during generation to reduce memory pressure                       | Enabled  |
| `enableLayerRef`            | Transfers layers by ID reference instead of full data per batch, reducing inter-worker message overhead | Disabled |
| `enableAdaptiveBatchSize`   | Adjusts batch size based on collection size and device hardware capabilities                            | Enabled  |
| `enableZipWorkerOffloading` | Offloads ZIP creation to a dedicated Web Worker to keep the main thread responsive                      | Disabled |

Enable or disable flags in **Project Settings → Feature Flags** before starting generation.

## Monitoring Progress

During generation, you can monitor:

### Progress Indicators

- **Completion percentage** and item count
- **Estimated time remaining**
- **Memory usage** and system resources
- **Current processing chunk**

### Real-time Previews

- **Individual item previews** every 100 items (for large collections)
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

Each item includes standard metadata. The exact fields depend on the chosen metadata standard.

#### ERC-721 (EVM)

```json
{
	"name": "My Collection #1",
	"description": "A unique item from My Collection",
	"image": "1.png",
	"external_url": "https://example.com/item/1",
	"animation_url": "",
	"youtube_url": "",
	"background_color": "",
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

#### Solana (Metaplex)

```json
{
	"name": "My Collection #1",
	"symbol": "MYCOL",
	"description": "A unique item from My Collection",
	"image": "1.png",
	"seller_fee_basis_points": 500,
	"attributes": [
		{
			"trait_type": "Background",
			"value": "Blue Sky"
		},
		{
			"trait_type": "Character",
			"value": "Robot"
		}
	],
	"creators": [
		{
			"address": "WalletAddressHere",
			"share": 100
		}
	],
	"collection": {
		"name": "My Collection",
		"family": "My Collection Family"
	},
	"properties": {
		"files": [
			{
				"uri": "1.png",
				"type": "image/png"
			}
		],
		"category": "image"
	}
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

| Size         | Approach            | Details                            |
| ------------ | ------------------- | ---------------------------------- |
| 1-100        | Standard generation | CSP solving + worker rendering     |
| 101-1,000    | Streaming storage   | IndexedDB streaming + standard ZIP |
| 1,001-3,000  | Optimized chunking  | Chunked ZIP processing             |
| 3,001-10,000 | Multi-ZIP export    | Split into 1 GB ZIP files          |

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
   - `images/` folder with all generated item images (PNG format)
   - `metadata/` folder with JSON metadata files
   - Standard item metadata format compatible with most marketplaces

> **Note**: The system automatically packages your complete collection with proper folder structure and metadata using the optimal export strategy for your collection size.

## Related Documentation

- [Adding Traits](./user-guide-adding-traits.md)
- [Project Management](../README.md#project-management)
- [Export Options](../README.md#export-options)
- [Performance Optimization](../README.md#performance-optimizations)
