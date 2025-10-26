# NFT Studio TODO

## Gallery Mode Implementation

### Overview

Add a new Gallery page with mode switching between "Generate Mode" and "Gallery Mode" for viewing generated NFT collections.

### Components to Create

#### 1. Gallery Route Structure

- [ ] Create `src/routes/app/gallery/+page.svelte` - Main gallery page
- [ ] Create `src/routes/app/gallery/+layout.svelte` - Gallery-specific layout (if needed)
- [ ] Update `src/routes/app/+layout.svelte` to include mode switcher

#### 2. Mode Switcher Component

- [ ] Create `src/lib/components/ModeSwitcher.svelte` - Dropdown for switching modes
- [ ] Position in top-right of app page
- [ ] Options: "Generate Mode" (current) and "Gallery Mode" (new)
- [ ] Route between `/app` and `/app/gallery`

#### 3. Gallery State Management

- [ ] Create `src/lib/stores/gallery.store.svelte.ts` - Store for generated NFTs
- [ ] Store NFT images, metadata, and calculated rarity information
- [ ] Use IndexedDB for persistence of generated collections
- [ ] Include search, filtering, and sorting capabilities

#### 4. Gallery Grid View Component

- [ ] Create `src/lib/components/gallery/GalleryGrid.svelte` - Main grid layout
- [ ] Responsive grid design (mobile: 1-2 cols, tablet: 3-4 cols, desktop: 5-6 cols)
- [ ] Show NFT image with name overlay
- [ ] Include rarity indicator/badge
- [ ] Add loading states and skeleton screens

#### 5. NFT Detail View Component

- [ ] Create `src/lib/components/gallery/NFTDetail.svelte` - Detail panel
- [ ] Display full-size NFT image
- [ ] Show NFT name and description
- [ ] List all traits with their properties
- [ ] Display rarity rank and rarity score
- [ ] Show trait rarity percentages

#### 6. Rarity Calculation System

- [ ] Create `src/lib/domain/rarity-calculator.ts` - Rarity calculation logic
- [ ] Calculate trait rarity percentages within collection
- [ ] Calculate overall NFT rarity scores
- [ ] Rank NFTs by rarity (1 being most rare)
- [ ] Consider special trait combinations for bonus rarity

#### 7. Gallery Page Layout

- [ ] Create two-column layout: left grid, right detail panel
- [ ] Responsive design: stack on mobile, side-by-side on desktop
- [ ] Add collection statistics (total NFTs, rare traits, etc.)
- [ ] Include search and filter controls
- [ ] Add sort options (by name, rarity, traits, etc.)

#### 8. Integration with Generation System

- [ ] Modify `src/lib/components/GenerationForm.svelte` to save results
- [ ] Store generated NFTs in gallery store after completion
- [ ] Add option to import existing collections
- [ ] Handle memory management for large collections
- [ ] Implement lazy loading for performance

#### 9. Additional Features

- [ ] Add zoom functionality for NFT images
- [ ] Implement bulk selection for actions
- [ ] Add export functionality for selected NFTs
- [ ] Include trait analysis and statistics
- [ ] Add comparison mode between NFTs

### Technical Considerations

#### Data Structure

```typescript
interface GalleryNFT {
	id: string;
	name: string;
	description?: string;
	imageData: ArrayBuffer;
	imageUrl?: string;
	metadata: {
		traits: Array<{
			layer: string;
			trait: string;
			rarity: number;
		}>;
	};
	rarityScore: number;
	rarityRank: number;
	collectionId: string;
	generatedAt: Date;
}

interface GalleryCollection {
	id: string;
	name: string;
	description: string;
	projectName: string;
	nfts: GalleryNFT[];
	generatedAt: Date;
	totalSupply: number;
}
```

#### Performance Optimization

- Use virtual scrolling for large collections
- Implement image lazy loading
- Use WebP format for better compression
- Cache calculated rarity scores
- Implement pagination or infinite scroll

#### UI/UX Considerations

- Smooth transitions between generate and gallery modes
- Loading states for all operations
- Error handling for failed operations
- Responsive design for all screen sizes
- Keyboard navigation support
- Accessibility features (ARIA labels, etc.)

### Implementation Order

1. Create basic route structure and mode switcher
2. Implement gallery state management and storage
3. Build basic grid view with mock data
4. Create detail view component
5. Implement rarity calculation system
6. Connect generation output to gallery
7. Add advanced features and optimizations
8. Testing and refinement
