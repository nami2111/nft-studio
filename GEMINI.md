# GEMINI.md: AI Assistant Guide

This document provides context for AI assistants (like the Gemini CLI) to understand the structure, goals, and technical stack of the NFT Generative Collection Studio project.

## 1. Project Goal

The primary goal is to build a client-side web application that allows users to upload layers of artwork, configure rarity, and generate a complete NFT collection (images and metadata) directly in their browser, ready for download as a .zip file.

## 2. Core Technologies (Tech Stack)

The project is built on a modern, decentralized-first stack.

- **Framework:** SvelteKit
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn-svelte (using bits-ui and svelte-headlessui)
- **Icons:** lucide-svelte
- **Deployment & BaaS:** Juno.build (for Internet Computer - ICP)
- **Core Logic Libraries:**
  - JSZip: For creating the final .zip package on the client side.
  - svelte-dnd-action: For drag-and-drop layer reordering.
- **Concurrency:** Native Web Workers and OffscreenCanvas API.

## 3. Project Structure Overview

The codebase is organized following SvelteKit conventions.

- `src/routes/`: Contains the main pages of the application. The primary logic will live in `src/routes/+page.svelte`.
- `src/lib/`: This is where most of the application's logic and reusable code resides.
- `src/lib/components/`: Contains all reusable Svelte components (e.g., `LayerManager.svelte`, `TraitCard.svelte`, `GenerationModal.svelte`).
- `src/lib/stores/`: For Svelte stores that manage the application's global state (e.g., the main project object).
- `src/lib/workers/`: Contains the Web Worker script (`generation.worker.ts`). This is where the heavy lifting happens.
- `src/lib/types/`: Holds all TypeScript interface definitions (`project.ts`, `layer.ts`, etc.).
- `src/lib/utils/`: For helper functions.

## 4. Key Architectural Patterns

- **Client-Side Generation:** All core logic (image composition, file packaging) runs in the user's browser. The backend (Juno) only serves the static frontend assets.

- **UI/Worker Separation:** The main UI thread is responsible only for state management and rendering. The `generation.worker.ts` script handles all computationally intensive tasks:
  - Receives layer and rarity data from the UI thread.
  - Uses OffscreenCanvas to compose images in the background.
  - Calculates rarity and generates metadata.
  - Posts progress updates and the final result back to the UI thread.

- **State Management:** A single, writable Svelte store (`project.store.ts`) acts as the single source of truth for the entire collection being built. Components react to changes in this store.

## 5. Development Commands

- **Run development server:** `pnpm dev` or `juno dev`
- **Install dependencies:** `pnpm install`
- **Build for production:** `pnpm build`
- **Deploy to ICP:** `juno deploy`
- **Add UI components:** `pnpm dlx shadcn-svelte@latest add [component_name]`
