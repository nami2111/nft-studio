# Technical Specification: NFT Generative Collection Studio

Version: 1.0  
Date: August 6, 2025  
Related Document: PRD - NFT Generative Collection Studio (v1.1)

## 1. System Architecture

The application will be a Single Page Application (SPA) architected for a fully client-side, decentralized execution environment.

### 1.1. High-Level Diagram

```text
[User's Browser]
 |
 +-- [Main UI Thread] <---------------------> [Juno/ICP Backend]
 |    | - SvelteKit/React Components         |    - Serves Frontend Assets
 |    | - UI State Management (Stores)       |    - Authentication (Internet Identity)
 |    | - User Input Handling                |    - Project Data Storage (Future)
 |    | - DOM Manipulation
 |
 +-- [Web Worker Thread] (background)
      | - Image Composition (OffscreenCanvas)
      | - Rarity & Rules Logic
      | - Batch Processing Loop
      | - Metadata Generation
```

### 1.2. Core Principles

- **Zero Backend Computation for Generation:** The Juno/ICP backend's sole responsibility during generation is to serve the initial application assets. All computational heavy lifting is offloaded to the user's browser.
- **UI Responsiveness:** The Web Worker is critical. It ensures the main UI thread is never blocked, allowing for a smooth user experience with responsive controls (like a 'Cancel' button) even during intensive processing.
- **Stateless Generation:** The generation process itself is stateless. The worker receives all necessary data at the start, processes it, and returns the complete result, requiring no back-and-forth communication for its core logic.

## 2. Data Models (TypeScript Interfaces)

These interfaces define the core data structures of the application.

```typescript
// project.ts
interface Project {
	id: string;
	name: string;
	description: string;
	outputSize: {
		width: number;
		height: number;
	};
	layers: Layer[];
}

// layer.ts
interface Layer {
	id: string; // e.g., 'background'
	name: string; // e.g., 'Background'
	order: number; // Stacking order, e.g., 0, 1, 2...
	isOptional?: boolean; // For v1.1 Rules Engine
	traits: Trait[];
}

// trait.ts
interface Trait {
	id: string;
	name: string; // e.g., 'Blue.png'
	imageUrl: string; // Object URL created from uploaded file
	imageData: File; // The raw file object
	rarityWeight: number; // Integer from 1 (rarest) to 5 (most common)
}
```

## 3. Component Breakdown (SvelteKit Example)

The UI will be broken down into modular, reusable components.

- `routes/+page.svelte` (Main Page)
  - Manages the overall project state.
  - Composes the main layout.
- `components/ProjectSettings.svelte`
  - Inputs for project name, description, and output dimensions.
  - Dispatches events when values change.
- `components/LayerManager.svelte`
  - Renders a list of LayerItem components.
  - Implements drag-and-drop functionality (svelte-dnd-action) to reorder layers.
  - Handles adding new layers.
- `components/LayerItem.svelte`
  - Displays the layer name.
  - Contains a grid of TraitCard components for that layer.
  - Handles the file upload logic for adding new traits to its layer.
- `components/TraitCard.svelte`
  - Displays a thumbnail of the trait image.
  - Shows the trait's file name.
  - Contains the RaritySlider component.
- `components/RaritySlider.svelte`
  - A slider or input group to set the rarityWeight (1-5) for a trait.
  - Dispatches an event on change, bubbling up to update the main project state.
- `components/GenerationModal.svelte`
  - A dialog that appears when the user clicks "Generate".
  - Contains an input for the number of NFTs to generate.
  - Displays the ProgressBar and status text.
  - Contains the "Start", "Cancel", and "Close" buttons.
  - Manages the Web Worker lifecycle.
- `components/ProgressBar.svelte`
  - A visual component that updates its width based on generation progress.

## 4. Core Logic Implementation

### 4.1. Web Worker Interface (`generation.worker.ts`)

The worker will listen for a single message type, `start`, and post back multiple message types.

**Message from Main Thread to Worker:**

```typescript
interface StartMessage {
	type: 'start';
	payload: {
		layers: Layer[];
		collectionSize: number;
	};
}
```

**Messages from Worker to Main Thread:**

```typescript
interface ProgressMessage {
	type: 'progress';
	payload: {
		generatedCount: number;
		totalCount: number;
		statusText: string;
	};
}

interface CompleteMessage {
	type: 'complete';
	payload: {
		images: { name: string; blob: Blob }[];
		metadata: { name: string; data: object }[];
	};
}

interface ErrorMessage {
	type: 'error';
	payload: {
		message: string;
	};
}
```

### 4.2. Image Composition Logic (inside Worker)

For each NFT to be generated:

- Create an OffscreenCanvas with the project's output dimensions.
- Get the 2D rendering context: `const ctx = canvas.getContext('2d');`
- Iterate through the layers in their specified order.
- For each layer, select a trait based on the rarity algorithm.
- If a trait is selected, use `createImageBitmap(trait.imageData)` to get a drawable image source.
- Draw the image onto the OffscreenCanvas: `ctx.drawImage(imageBitmap, 0, 0);`
- After all layers are drawn, convert the canvas to a Blob: `const blob = await canvas.convertToBlob({ type: 'image/png' });`
- Store the blob and the generated metadata.

### 4.3. Rarity Algorithm (inside Worker)

```typescript
function selectTrait(layer: Layer): Trait | null {
	// Handle optional layers first (v1.1)
	// ...

	const totalWeight = layer.traits.reduce((sum, trait) => sum + trait.rarityWeight, 0);
	let randomNum = Math.random() * totalWeight;

	for (const trait of layer.traits) {
		if (randomNum < trait.rarityWeight) {
			return trait;
		}
		randomNum -= trait.rarityWeight;
	}
	return null; // Should not happen if weights are valid
}
```

### 4.4. Final Packaging (inside Main Thread)

On receiving the complete message from the worker:

- Instantiate JSZip: `const zip = new JSZip();`
- Create folders: `const imgFolder = zip.folder('images');` and `const jsonFolder = zip.folder('json');`
- Loop through the images array from the worker payload and add each to the zip: `imgFolder.file(image.name, image.blob);`
- Loop through the metadata array and add each to the zip: `jsonFolder.file(meta.name, JSON.stringify(meta.data, null, 2));`
- Generate the final zip file: `zip.generateAsync({ type: 'blob' }).then(...)`
- Create a temporary URL from the zip blob and trigger a download.

## 5. Deployment Strategy

- **Setup:** Initialize the project using the Juno CLI: `juno new --template svelte`.
- **Development:** Run the local development server using `juno dev`.
- **Deployment:**
  - Login to Juno/ICP: `juno login`.
  - Deploy the application to an ICP canister: `juno deploy`.
- **Configuration:** The Juno CLI will handle the configuration of `dfx.json` and canister management, abstracting away the underlying dfx commands.
