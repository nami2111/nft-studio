# User Guide: Gallery Mode

Gallery Mode provides a powerful interface for viewing, filtering, and managing your generated item collections. This guide covers all features available in Gallery Mode.

## Overview

Gallery Mode allows you to:

- Import existing item collections from ZIP files
- View collections with advanced filtering and search
- Use interactive trait filtering for precise exploration
- Analyze rarity scores and rankings
- Manage multiple collections in one interface

## Accessing Gallery Mode

1. From the main app interface, click **"Gallery Mode"** in the top-right corner
2. Or navigate directly to `/app/gallery` in your browser

## Importing Collections

### Supported Format

Gallery Mode accepts ZIP files with the following structure:

```
Expected structure:
├── images/ (PNG/JPG files)
└── metadata/ (JSON files, optional)
```

### Import Process

1. **Drag & Drop**: Simply drag a ZIP file onto the import area
2. **Browse**: Click the import area or "Select ZIP File" button
3. **Automatic Processing**: The system will:
   - Extract images and metadata
   - Calculate rarity scores automatically
   - Organize items by collection
   - Provide real-time progress updates

### Import Requirements

- **Required**: `images/` folder containing PNG/JPG image files
- **Optional**: `metadata/` folder containing JSON metadata files with traits
- **File Limit**: No strict size limit, but very large files may take longer to process
- **Format**: ZIP files exported from GNStudio or compatible tools

## Collection Management

### Viewing Collections

- **Collection Selector**: Switch between multiple imported collections
- **Collection Stats**: View total item count and collection information
- **Responsive Grid**: Optimized layouts for mobile, tablet, and desktop

### Collection Statistics

For each collection, you can see:

- **Total items**: Number of items in the collection
- **Rarest Item**: The item with the highest rarity score
- **Average Score**: Mean rarity score across all items
- **Creation Date**: When the collection was imported

## Item Details and Analysis

### Viewing Item Details

1. Click any item in the grid to view detailed information
2. The right panel (desktop) or bottom panel (mobile) shows:
   - Full-size item image
   - item name and description
   - Rarity score and global rank
   - Complete trait list with individual rarity percentages

### Rarity Calculation Methods

GNStudio supports six distinct rarity calculation methods, each providing a different perspective on item rarity:

- **TRAIT_RARITY**: Sum of individual trait rarity scores. Each trait's score is `(Total items ÷ Number of items with trait)`. All traits are summed for the final item score.
- **AVERAGE_TRAIT_RARITY**: Average of trait rarity scores rather than sum. Normalizes across items with different numbers of traits, preventing trait-heavy items from dominating.
- **WEIGHTED_TRAIT_RARITY**: Later layers get progressively higher weight multipliers. Assumes later layers (overlays) are more visually impactful and should influence rarity more.
- **STANDARD_DEVIATION**: Statistical deviation-based scoring. Measures how far each trait's frequency deviates from the mean. Items whose traits all deviate significantly score higher.
- **ENHANCED_WEIGHTED**: Custom weights combined with a tiered rarity system. Allows manual tuning of layer importance alongside automatic tier assignment.
- **EMERGENT_RARITY**: Based on the full trait combination's uniqueness across the collection. An item with a unique combination of otherwise common traits can rank highly.

**Rarity Tiers**: Items are classified into tiers based on percentile thresholds:

| Tier | Percentile | Description |
|------|-----------|-------------|
| Legendary | Top 1% | Extremely rare, one-of-a-kind combinations |
| Epic | Top 5% | Very rare items with exceptional traits |
| Rare | Top 15% | Uncommon items with notable rarity |
| Uncommon | Top 35% | Above-average rarity |
| Common | Remaining | Standard items found frequently |

**Strategic Trait Classification**: Each trait is classified into one of three categories based on its impact on rarity scoring:

- **Strategic**: Traits that significantly influence rarity (rare traits, unique combinations)
- **Balanced**: Traits with moderate rarity impact (average frequency)
- **Filler**: Common traits used frequently across the collection (low rarity impact)

## Interactive Trait Filtering

### How It Works

Gallery Mode features revolutionary interactive trait filtering:

1. **View Item Details**: Click any item to see its traits
2. **Click Traits**: Click individual traits to instantly filter the entire collection
3. **Build Filters**: Select multiple traits from different layers for precise filtering
4. **Visual Feedback**: Selected traits are highlighted with primary color styling

### Filter Examples

- **Single Trait**: Click "Golden Crown" to see all items with that trait
- **Multiple Traits**: Click "Red Background" + "Wizard Hat" for items with both traits
- **Cross-Layer**: Combine traits from different layers (e.g., "Blue Eyes" + "Black Armor")
- **Clear Filters**: Use "Clear All" button or click selected traits again to remove

### Filter Controls

- **Search Bar**: Find items by name or description
- **Sort Options**:
  - Rarity (Low to High = common to rare)
  - Rarity (High to Low = rare to common)
  - Name (A-Z or Z-A)
- **Active Filters**: Shows number of active trait filters

## Search and Sort

### Filter Caching

Gallery Mode uses an intelligent caching system for filtered results:

- **LRU Cache**: Least Recently Used cache with a maximum of 50 entries for filtered result sets. Frequently accessed filter combinations stay in memory.
- **Cache Key**: Derived from the active filters + collection ID + sort option, ensuring each unique filter state has its own cached result.
- **Trait Index**: Pre-computed `Map<"layer:trait", Set<itemId>>` lookup structure for O(1) trait-based filtering. Built once at import time.
- **Invalidation**: Cache entries are invalidated automatically on collection change or filter modification, ensuring stale results are never served.

### Search Functionality

- **Real-time Search**: Instant results as you type
- **Global Search**: Searches item names, descriptions, and trait values
- **Case Insensitive**: "dragon" matches "Dragon" and "dragon"

### Sorting Options

- **Rarity Score**: Sort by calculated rarity (ascending/descending)
- **Name**: Alphabetical sorting (A-Z or Z-A)
- **Rank**: Sort by global rarity ranking

#### Natural Numeric Sorting

Item names containing numbers are sorted with natural numeric ordering so sequences like "Foxinity #1", "#001", and "Item 42" sort correctly:

- Numeric parts within names are compared numerically (e.g., `#2` before `#10`)
- Text parts are compared alphabetically using locale-aware collation
- Handles mixed patterns like `"Set 3 - Variant 12"` where multiple number groups exist in a single name

## Responsive Design

### Mobile Layout

- **Full-width Grid**: Optimized for touch interactions
- **Bottom Details Panel**: item details slide up from bottom
- **Horizontal Traits**: Swipeable trait pills for compact display
- **Custom Dropdowns**: Mobile-friendly sorting without native pickers

### Desktop Layout

- **70/30 Split**: Grid view (70%) and details panel (30%)
- **Fixed Details Panel**: Persistent item information panel
- **Advanced Filtering**: Comprehensive trait filtering interface
- **Keyboard Support**: Full keyboard navigation and shortcuts

## Memory and Performance

### Cache Management

- **Automatic Cleanup**: Cache clears on page refresh for fresh starts
- **Efficient Loading**: Progressive loading prevents UI blocking
- **Memory Optimization**: Smart cleanup for large collections

### Three-Tier Image Cache

Images are cached across three tiers for optimal memory usage:

| Tier | Limit | Entries | TTL | Description |
|------|-------|---------|-----|-------------|
| ImageBitmap | 100MB | 500 | 30 min | Fastest rendering, decoded GPU-ready bitmaps |
| ImageData | 50MB | 200 | 15 min | Raw pixel data for canvas operations |
| ArrayBuffer | 200MB | 1000 | 1 hour | Compressed binary data, slowest but most space-efficient |

### Memory Pressure Handling

Automatic cleanup triggers at three thresholds:

- **Aggressive (800MB)**: Evicts all tiers, keeps only visible images in memory
- **Moderate (500MB)**: Evicts ImageBitmap and ImageData tiers, retains ArrayBuffer cache
- **Light (200MB)**: Evicts oldest ImageBitmap entries, preserves other tiers

### Streaming Import

Large collections use streaming to avoid memory bottlenecks:

- **`createStreamingCollection()`**: Creates metadata-only collection entries first, then streams individual images to IndexedDB one at a time
- **Storage Estimation**: `getStorageEstimate()` monitors IndexedDB quota usage, warning when approaching browser limits
- **Progress Tracking**: Real-time byte-level progress during import

### Performance Features

- **Web Workers**: Background processing for rarity calculations
- **Virtual Scrolling**: Smooth performance with large collections
- **Adaptive Loading**: Optimized based on device capabilities

## Troubleshooting

### Common Issues

**Import Fails**:

- Ensure ZIP file contains `images/` folder at root level
- Check that image files are PNG or JPG format
- Verify ZIP file isn't corrupted

**No Traits Displayed**:

- Check if metadata folder exists in ZIP file
- Ensure JSON files follow standard format with attributes array
- Metadata is optional - items will import without it

**Slow Performance**:

- Large collections (>5000 items) may take longer to process
- Consider importing in smaller batches
- Close other browser tabs to free memory

**Mobile Dropdown Issues**:

- Use custom dropdowns (not native mobile pickers)
- Ensure sufficient memory available
- Try refreshing if dropdowns don't respond

### File Format Requirements

**Images**:

- Supported formats: PNG, JPG, WebP, GIF
- Automatic format detection for WebP and GIF during import
- Consistent dimensions across all images recommended
- Maximum dimensions: 4096×4096 pixels

**Metadata** (Optional):

- JSON files with `attributes` array
- Standard format: `{"trait_type": "Background", "value": "Blue"}`
- Alternative format: `{"layer": "Background", "trait": "Blue"}`

## Tips and Best Practices

### Import Organization

- **Descriptive Names**: Use clear ZIP file names for easy identification
- **Consistent Structure**: Always maintain the same folder structure
- **Metadata Quality**: Include comprehensive trait information for better filtering

### Filtering Strategies

- **Start Broad**: Filter by rare traits first, then add specific combinations
- **Layer by Layer**: Build filters progressively, observing results
- **Save Interesting Combinations**: Note rare trait combinations for future reference

### Collection Analysis

- **Identify Patterns**: Look for common trait combinations in rare items
- **Rarity Discovery**: Use filtering to discover unexpected trait relationships
- **Quality Assessment**: Review trait distribution for collection balance

## Advanced Features

### Trait Rarity Analysis

Gallery Mode automatically calculates and displays:

- **Individual Trait Rarity**: Percentage of items with each specific trait
- **Trait Rankings**: Most and least common traits in the collection
- **Rarity Distribution**: Overall rarity score distribution across collection

### Trait Statistics

Detailed statistical analysis tools for in-depth trait exploration:

- **Top 20 Rarest Traits**: Lists the 20 rarest traits with their exact counts and percentage of occurrence across the collection
- **Individual Trait Percentages**: Every trait displays its precise rarity percentage (e.g., "Golden Crown appears in 3.2% of items")
- **Rarity Distribution Chart**: Visual breakdown of how rarity scores are distributed, showing clusters and outliers
- **Jaccard Similarity**: Measures trait overlap between items to find related items. `J(A,B) = |A ∩ B| / |A ∪ B|`. Useful for discovering visually similar items or trait combination clusters.

### Collection Comparison

Import multiple collections to:

- **Compare Rarity**: See which collection has rarer traits overall
- **Trait Analysis**: Compare trait distributions between collections
- **Quality Assessment**: Evaluate trait variety and uniqueness

### Export Considerations

While Gallery Mode focuses on viewing and analysis, you can:

- **Document Findings**: Take screenshots of rare trait combinations
- **Filter Results**: Note specific trait filters that yield interesting results
- **Collection Insights**: Record analytics and patterns discovered

## Integration with Generate Mode

Gallery Mode works seamlessly with Generate Mode:

1. **Generate Collection**: Create items in Generate Mode
2. **Export Collection**: Download as ZIP with images and metadata
3. **Import to Gallery**: Upload ZIP to Gallery Mode for analysis
4. **Analyze and Filter**: Use Gallery Mode tools to explore your collection
5. **Iterate**: Return to Generate Mode with insights for improvements

This workflow enables continuous refinement of your item collections based on data-driven analysis.
