# NFT Studio — Product

NFT Studio is a web-based tool for creating, managing, and exporting NFT collections.
It is built with SvelteKit and TypeScript to provide a fast, type-safe development experience.
The primary workflow lets creators upload traits and layers, configure project details,
generate final art, and export a ZIP containing images and metadata.

Key goals
- Enable trait and layer uploads to define a collection
- Provide a guided project setup for name, description, and metadata
- Run an end-to-end generation pipeline with progress updates
- Package the assets into a ZIP with images and JSON metadata
- Integrate with Juno-backed services where applicable

Core features
- Trait and layer management UI
- Project settings panel
- Batch generation with progress feedback
- ZIP export and download

Tech stack
- Frontend: SvelteKit, TypeScript
- Styling: Tailwind CSS
- Persistence: IndexedDB
- Background tasks: Web Workers
- Backend integration: Juno

Conclusion
NFT Studio aims to streamline NFT collection creation from trait uploads to a downloadable ZIP, all in a cohesive UI and robust frontend architecture.