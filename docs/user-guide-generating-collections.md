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

Use the generation controls to configure your collection:

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
2. **Review generation settings**
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

- **Behavior**: Images stream incrementally to a persistent ZIP worker during generation, avoiding memory accumulation
- **Benefit**: Main thread stays responsive; ZIP is built incrementally as items are generated
- **When active**: Default export path during generation (when `enableStreamingStorage` is disabled)
- **Compatible with**: All modern browsers with Web Worker support

### Storage Streaming

- **Behavior**: Images stream to browser object storage during generation, then packaged into ZIP files in size-bounded batches after generation completes
- **Benefit**: Reduces peak memory usage by 60-80% for large collections; RAM stays bounded regardless of collection size
- **When active**: Only when `enableStreamingStorage` feature flag is enabled (default: enabled)
- **Batch sizing**: Each ZIP batch is capped at a target size (default 500MB), with multiple ZIP files downloaded sequentially
- **Storage scope**: Browser storage is private to this browser profile and quota-managed by the browser

### Worker-Offloaded ZIP

- **Best for**: Collections with more than 500 items
- **Behavior**: ZIP creation runs in a dedicated Web Worker
- **Benefit**: Keeps the main thread responsive during compression
- **When active**: Only when `enableZipWorkerOffloading` is enabled

## Feature Flags

GNStudio exposes feature flags to fine-tune the generation pipeline:

| Flag                        | Description                                                                                                | Default  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `enableStreamingStorage`    | Streams generated images to browser storage during generation, then packages into size-bounded ZIP batches | Enabled  |
| `enableLayerRef`            | Transfers layers by ID reference instead of full data per batch, reducing inter-worker message overhead    | Disabled |
| `enableAdaptiveBatchSize`   | Adjusts batch size based on collection size and device hardware capabilities                               | Enabled  |
| `enableZipWorkerOffloading` | Offloads one-shot ZIP creation to a dedicated Web Worker for collections > 500 items                       | Disabled |

Enable or disable flags with `VITE_ENABLE_*` / `VITE_DISABLE_*` environment variables before running the app. See [Feature Flags](./feature-flags.md).

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

| Size         | Approach             | Details                                                 |
| ------------ | -------------------- | ------------------------------------------------------- |
| 1-100        | Standard generation  | CSP solving + worker rendering                          |
| 101-500      | Streaming ZIP        | Incremental ZIP worker + standard ZIP                   |
| 501-1,000    | Worker-offloaded ZIP | Dedicated ZIP worker (if flag enabled) or streaming ZIP |
| 1,001-3,000  | Optimized chunking   | Chunked ZIP processing (100 items/chunk)                |
| 3,001-10,000 | Multi-ZIP export     | Split into 1 GB ZIP files with sequential downloads     |

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

- **Clear browser cache** before large generations
- **Use progressive preview** to reduce memory usage
- **Restart browser** if memory issues persist

#### Generation Failures

- **Verify all traits** have valid image data
- **Check layer configuration** for missing traits
- **Validate project dimensions** are set correctly
- **Review browser console** for error messages

### Recovery Options

- **Cancel and rerun** after reducing collection size or closing other tabs
- **Save/export the project** before starting large generations
- **Use auto-saved project state** to recover the current design after refresh

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

> **Multi-ZIP Downloads**: When exporting large collections that produce multiple ZIP files, downloads are triggered sequentially with 5-second intervals between each. This prevents browser download manager overload and ensures large blob URLs (700MB+) have time to begin streaming before the next download starts. Do not close the browser tab until all downloads have initiated.

## Related Documentation

- [Adding Traits](./user-guide-adding-traits.md)
- [Gallery Mode](./user-guide-gallery-mode.md)
- [Performance Architecture](./performance-architecture.md)
- [Feature Flags](./feature-flags.md)
