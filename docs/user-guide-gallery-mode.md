# User Guide: Gallery Mode

Gallery Mode provides a powerful interface for viewing, filtering, and managing your generated NFT collections. This guide covers all features available in Gallery Mode.

## Overview

Gallery Mode allows you to:

- Import existing NFT collections from ZIP files
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
   - Organize NFTs by collection
   - Provide real-time progress updates

### Import Requirements

- **Required**: `images/` folder containing PNG/JPG image files
- **Optional**: `metadata/` folder containing JSON metadata files with traits
- **File Limit**: No strict size limit, but very large files may take longer to process
- **Format**: ZIP files exported from NFT Studio or compatible tools

## Collection Management

### Viewing Collections

- **Collection Selector**: Switch between multiple imported collections
- **Collection Stats**: View total NFT count and collection information
- **Responsive Grid**: Optimized layouts for mobile, tablet, and desktop

### Collection Statistics

For each collection, you can see:

- **Total NFTs**: Number of NFTs in the collection
- **Rarest NFT**: The NFT with the highest rarity score
- **Average Score**: Mean rarity score across all NFTs
- **Creation Date**: When the collection was imported

## NFT Details and Analysis

### Viewing NFT Details

1. Click any NFT in the grid to view detailed information
2. The right panel (desktop) or bottom panel (mobile) shows:
   - Full-size NFT image
   - NFT name and description
   - Rarity score and global rank
   - Complete trait list with individual rarity percentages

### Rarity Scoring System

Understanding how rarity is calculated:

- **Trait Rarity**: `(Number of NFTs with trait ÷ Total NFTs) × 100`
- **Trait Score**: `100 ÷ Trait Percentage` (rarer = higher score)
- **NFT Score**: Sum of all trait scores (higher = rarer)
- **Ranking**: Rank #1 = most rare NFT (highest score)

**Example**: A trait appearing in 50 out of 1000 NFTs has 5% rarity and a score of 20 points.

## Interactive Trait Filtering

### How It Works

Gallery Mode features revolutionary interactive trait filtering:

1. **View NFT Details**: Click any NFT to see its traits
2. **Click Traits**: Click individual traits to instantly filter the entire collection
3. **Build Filters**: Select multiple traits from different layers for precise filtering
4. **Visual Feedback**: Selected traits are highlighted with primary color styling

### Filter Examples

- **Single Trait**: Click "Golden Crown" to see all NFTs with that trait
- **Multiple Traits**: Click "Red Background" + "Wizard Hat" for NFTs with both traits
- **Cross-Layer**: Combine traits from different layers (e.g., "Blue Eyes" + "Black Armor")
- **Clear Filters**: Use "Clear All" button or click selected traits again to remove

### Filter Controls

- **Search Bar**: Find NFTs by name or description
- **Sort Options**:
  - Rarity (Low to High = common to rare)
  - Rarity (High to Low = rare to common)
  - Name (A-Z or Z-A)
- **Active Filters**: Shows number of active trait filters

## Search and Sort

### Search Functionality

- **Real-time Search**: Instant results as you type
- **Global Search**: Searches NFT names, descriptions, and trait values
- **Case Insensitive**: "dragon" matches "Dragon" and "dragon"

### Sorting Options

- **Rarity Score**: Sort by calculated rarity (ascending/descending)
- **Name**: Alphabetical sorting (A-Z or Z-A)
- **Rank**: Sort by global rarity ranking

## Responsive Design

### Mobile Layout

- **Full-width Grid**: Optimized for touch interactions
- **Bottom Details Panel**: NFT details slide up from bottom
- **Horizontal Traits**: Swipeable trait pills for compact display
- **Custom Dropdowns**: Mobile-friendly sorting without native pickers

### Desktop Layout

- **70/30 Split**: Grid view (70%) and details panel (30%)
- **Fixed Details Panel**: Persistent NFT information panel
- **Advanced Filtering**: Comprehensive trait filtering interface
- **Keyboard Support**: Full keyboard navigation and shortcuts

## Memory and Performance

### Cache Management

- **Automatic Cleanup**: Cache clears on page refresh for fresh starts
- **Efficient Loading**: Progressive loading prevents UI blocking
- **Memory Optimization**: Smart cleanup for large collections

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
- Metadata is optional - NFTs will import without it

**Slow Performance**:

- Large collections (>5000 NFTs) may take longer to process
- Consider importing in smaller batches
- Close other browser tabs to free memory

**Mobile Dropdown Issues**:

- Use custom dropdowns (not native mobile pickers)
- Ensure sufficient memory available
- Try refreshing if dropdowns don't respond

### File Format Requirements

**Images**:

- PNG or JPG format recommended
- Consistent dimensions across all images
- Maximum size: 4096×4096 pixels

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

- **Identify Patterns**: Look for common trait combinations in rare NFTs
- **Rarity Discovery**: Use filtering to discover unexpected trait relationships
- **Quality Assessment**: Review trait distribution for collection balance

## Advanced Features

### Trait Rarity Analysis

Gallery Mode automatically calculates and displays:

- **Individual Trait Rarity**: Percentage of NFTs with each specific trait
- **Trait Rankings**: Most and least common traits in the collection
- **Rarity Distribution**: Overall rarity score distribution across collection

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

1. **Generate Collection**: Create NFTs in Generate Mode
2. **Export Collection**: Download as ZIP with images and metadata
3. **Import to Gallery**: Upload ZIP to Gallery Mode for analysis
4. **Analyze and Filter**: Use Gallery Mode tools to explore your collection
5. **Iterate**: Return to Generate Mode with insights for improvements

This workflow enables continuous refinement of your NFT collections based on data-driven analysis.
