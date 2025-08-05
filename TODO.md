# TODO: NFT Generative Collection Studio Development Plan

This document outlines the development tasks required to build the application from setup to deployment.

## Phase 1: Project Setup & Foundation (The Groundwork)

### 1.1. Initialize Environment

- [x] Install pnpm package manager.
- [x] Install the Juno CLI (`npm i -g @junobuild/cli`).
- [x] Log in to Juno (`juno login`).

### 1.2. Create Project

- [x] Initialize a new SvelteKit project using Juno (`pnpm create juno -- --template sveltekit-starter`).
- [x] Initialize a Git repository (`git init`).
- [x] Create the initial commit.

### 1.3. Install Core Dependencies

- [x] Add Tailwind CSS to the SvelteKit project.
- [x] Add shadcn-svelte and its dependencies.
- [x] Add lucide-svelte for icons.
- [x] Add svelte-dnd-action for drag-and-drop.
- [x] Add jszip.

### 1.4. Define Data Structures

- [x] Create TypeScript interface files (`project.ts`, `layer.ts`, `trait.ts`) as defined in `SPEC.md`.

### 1.5. Basic Layout

- [x] Create the main application layout in `routes/+layout.svelte` with a header and a main content area.

## Phase 2: UI Component Scaffolding (The Skeleton)

This phase focuses on building the visual components without full interactivity.

### 2.1. Project Management UI

- [x] Build `ProjectSettings.svelte` with input fields for name, description, and dimensions.

### 2.2. Layer Management UI

- [x] Build `LayerManager.svelte` to display a list of layers.
- [x] Build `LayerItem.svelte` to represent a single layer, including a title and an area for traits. Add a file input for uploading images.

### 2.3. Trait Management UI

- [x] Build `TraitCard.svelte` to display a trait's image thumbnail and name.
- [x] Build `RaritySlider.svelte` inside the `TraitCard` to show a static slider (1–5).

### 2.4. Generator UI

- [x] Build `GenerationModal.svelte` using shadcn-svelte's Dialog component.
- [x] Add a number input, a static ProgressBar, and placeholder buttons ("Generate", "Cancel").

## Phase 3: Core Functionality & State Management (The Engine)

This phase brings the application to life with logic.

### 3.1. State Management

- [x] Create a Svelte writable store (`project.store.ts`) to hold the entire Project object.
- [x] Connect UI components to the store to read data (e.g., `LayerManager` reads the `project.layers` array).
- [x] Implement functions to update the store (e.g., `addLayer`, `updateProjectName`, `updateRarityWeight`).

### 3.2. Interactive Functionality

- [x] Implement the file upload logic in `LayerItem.svelte` to add new traits to the store.
- [x] Implement the drag-and-drop logic in `LayerManager.svelte` to reorder layers in the store.
- [x] Connect the `RaritySlider` to update the `rarityWeight` for a trait in the store.

### 3.3. Web Worker Implementation

- [x] Create the `generation.worker.ts` file.
- [x] Implement the message listeners (`onmessage`) and senders (`postMessage`) as defined in `SPEC.md`.
- [x] Implement the `selectTrait` rarity algorithm inside the worker.
- [x] Implement the image composition logic using `OffscreenCanvas` inside the worker.

## Phase 4: Integration & End-to-End Flow (Connecting the Pieces)

### 4.1. Connect Generator Modal

- [x] In `GenerationModal.svelte`, implement the "Generate" button's onClick handler.
- [x] The handler should create a new instance of the Web Worker.
- [x] It should send the start message with the project data from the Svelte store.

### 4.2. Handle Worker Communication

- [x] Implement the `onmessage` listener in `GenerationModal.svelte`.
- [x] Update the ProgressBar and status text when receiving progress messages.
- [x] Implement the Cancel button logic to terminate the worker (`worker.terminate()`).

### 4.3. Implement Final Output

- [x] When a complete message is received, trigger the JSZip logic.
- [x] Implement the function to package images and metadata into a zip file.
- [x] Implement the function to trigger the browser download.
- [x] Display a success notification to the user.

## Phase 5: Testing, Refinement & Deployment

### 5.1. Testing

- [x] Test the end-to-end flow with a small collection (e.g., 10 items, 3 layers).
- [x] Test with a large collection (e.g., 1000+ items) to ensure batching and the worker perform correctly.
- [x] Test the "Cancel" functionality mid-generation.
- [x] Test on different browsers (Chrome, Firefox).

### 5.2. Refinement

- [ ] Add loading spinners and disabled states to buttons during processing.
- [ ] Improve UI/UX based on testing feedback (e.g., clearer instructions, better error handling).
- [ ] Review and refactor code for clarity and performance.

### 5.3. Deployment

- [ ] Run a final build (`juno deploy`).
- [ ] Test the live application on the `icp-api.io` domain provided by Juno.

## Phase 6: Post-MVP (v1.1 and Beyond)

### 6.1. Rules Engine

- [ ] Design the UI for adding/editing inclusion and exclusion rules.
- [ ] Update the Web Worker logic to validate combinations against these rules.

### 6.2. Preview Feature

- [ ] Create a "Preview" panel where users can manually select traits to see a live combination.

### 6.3. Project Persistence

- [ ] Integrate Juno's datastore (`juno.json`, `juno.db`) to save and load user projects.
