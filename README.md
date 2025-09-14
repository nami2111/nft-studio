# NFT Studio

NFT Studio is a powerful web-based application for creating, managing, and generating Non-Fungible Tokens (NFTs). Built with SvelteKit, TypeScript, and modern web technologies, it provides an intuitive interface for artists and creators to design unique NFT collections.

## Features

- **Layer Management**: Organize your NFT collection with multiple layers (background, character, accessories, etc.)
- **Trait System**: Define traits for each layer with customizable rarity weights
- **Visual Preview**: Real-time preview of your NFT collection as you build it
- **Batch Generation**: Generate hundreds or thousands of unique NFT combinations
- **Rarity Control**: Fine-tune the distribution of traits with adjustable rarity sliders
- **Project Management**: Save, load, and export your projects
- **Web Worker Processing**: Offload intensive image processing to background workers
- **ZIP Export**: Package your entire collection for easy distribution
- **Performance Optimized**: Lazy loading, bundle size optimization, and Web Worker processing

## Tech Stack

- **Frontend**: SvelteKit 2, TypeScript, Tailwind CSS
- **UI Components**: bits-ui, lucide-svelte
- **State Management**: Svelte 5 runes and stores
- **Image Processing**: Canvas API with Web Workers for performance
- **Persistence**: IndexedDB for local storage, ZIP for export
- **Build Tool**: Vite with static adapter and bundle visualization
- **Deployment**: Static hosting ready

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- pnpm (package manager)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd nft-studio
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
# Build the application
pnpm build

# Preview the built application
pnpm preview
```

## Development

### Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable UI components
│   ├── domain/         # Business logic and models
│   ├── persistence/    # Data storage and retrieval
│   ├── stores/         # Svelte stores for state management
│   ├── types/          # TypeScript types and interfaces
│   ├── utils/          # Utility functions
│   └── workers/        # Web workers for background processing
├── routes/             # SvelteKit page routes
└── app.css             # Global styles
```

### Available Scripts

| Script                      | Description                      |
| --------------------------- | -------------------------------- |
| `pnpm dev`                  | Start development server         |
| `pnpm build`                | Build for production             |
| `pnpm preview`              | Preview production build         |
| `pnpm check`                | Run TypeScript and Svelte checks |
| `pnpm lint`                 | Check code style                 |
| `pnpm format`               | Format code                      |
| `pnpm test`                 | Run tests                        |
| `pnpm standardize-comments` | Standardize comment formatting   |

### Code Quality

We maintain high code quality standards:

- TypeScript for type safety
- Prettier for code formatting
- ESLint for linting
- JSDoc for documentation
- Comprehensive test coverage

## Architecture

NFT Studio follows a layered architecture:

1. **UI Layer**: Svelte components for user interaction
2. **Domain Layer**: Business logic and data models
3. **Persistence Layer**: Data storage and retrieval
4. **Worker Layer**: Background processing for intensive operations

See [Architecture Documentation](docs/architecture-diagrams.md) for more details.

## Contributing

We welcome contributions! Please see our [Onboarding Guide](docs/onboarding.md) for details on:

- Setting up the development environment
- Coding standards and best practices
- Testing guidelines
- Pull request process

## Roadmap

Check our [TODO List](TODO.md) for upcoming features and improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- UI components from [bits-ui](https://www.bits-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
