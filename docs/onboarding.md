# NFT Studio Onboarding Guide

Welcome to the NFT Studio development team! This guide will help you get set up and start contributing to the project.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (version 18 or higher)
- pnpm (package manager)
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nft-studio
```

### 2. Install Dependencies

```bash
pnpm install
```

This will automatically run post-install scripts including copying auth workers to the static directory.

### 3. Start the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
nft-studio/
├── docs/              # Documentation files
├── scripts/           # Utility scripts
├── src/               # Source code
│   ├── lib/           # Reusable components and utilities
│   ├── routes/        # SvelteKit page routes
│   └── app.css        # Global styles
├── static/            # Static assets
├── package.json       # Project configuration
└── README.md          # Project overview
```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
vitest

# Run tests with coverage
pnpm test:coverage
```

### Code Quality Checks

```bash
# Check for TypeScript and Svelte errors
pnpm check

# Lint code for style issues
pnpm lint

# Format code according to project standards
pnpm format

# Standardize comments
pnpm standardize-comments
```

### Building for Production

```bash
# Build the application
pnpm build

# Preview the built application
pnpm preview
```

## Contributing

### Branching Strategy

- Create feature branches from `main`
- Use descriptive branch names (e.g., `feature/add-layer-drag-drop`)
- Keep branches focused on a single feature or bug fix

### Commit Messages

Follow conventional commit format:

- `feat: Add layer drag and drop functionality`
- `fix: Resolve trait image loading issue`
- `docs: Update architecture documentation`
- `refactor: Optimize layer validation logic`

### Code Reviews

- All changes require review before merging
- Ensure tests pass and code quality checks are clean
- Address all review comments before merging

### Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run all checks (`pnpm check`, `pnpm lint`, `pnpm test`)
3. Create a PR with a clear description of changes
4. Request review from team members
5. Address feedback and merge after approval

## Project Architecture

The NFT Studio follows a layered architecture:

1. **UI Layer**: Svelte components for user interaction
2. **Domain Layer**: Business logic and data models
3. **Persistence Layer**: Data storage and retrieval
4. **Worker Layer**: Background processing for intensive operations

Refer to `docs/architecture-diagrams.md` for detailed architecture information.

## Coding Standards

Follow the coding standards documented in `docs/coding-standards.md`:

- Use TypeScript for type safety
- Document public APIs with JSDoc
- Write unit tests for critical functionality
- Maintain consistent code formatting

## Useful Scripts

| Script                      | Purpose                          |
| --------------------------- | -------------------------------- |
| `pnpm dev`                  | Start development server         |
| `pnpm build`                | Build for production             |
| `pnpm check`                | Run TypeScript and Svelte checks |
| `pnpm lint`                 | Check code style                 |
| `pnpm format`               | Format code                      |
| `pnpm test`                 | Run tests                        |
| `pnpm standardize-comments` | Standardize comment formatting   |

## Getting Help

- Check existing documentation in the `docs/` directory
- Review the TODO list in `TODO.md` for upcoming work
- Ask questions in the team chat
- Pair with experienced team members for complex features

## Common Tasks

### Adding a New Component

1. Create the component in `src/lib/components/`
2. Follow existing patterns for props and events
3. Add stories for documentation (if using Storybook)
4. Write tests for the component

### Adding a New Feature

1. Create a feature branch
2. Implement the feature following architecture patterns
3. Add tests for new functionality
4. Update documentation if needed
5. Create a pull request for review

### Fixing a Bug

1. Create a test that reproduces the bug
2. Fix the bug
3. Verify the test now passes
4. Create a pull request with a clear description of the issue and fix

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Juno Documentation](https://github.com/junobuild/juno)
- [Project TODO List](../TODO.md)
- [Architecture Documentation](./architecture-diagrams.md)
- [Coding Standards](./coding-standards.md)

## UI Flow Screenshots

> **Note**: Screenshots will be added as the UI evolves. This section documents the expected user interface flow.

### Main Application Interface

- **Project Management**: Create, save, and load NFT projects
- **Layer Management**: Add, remove, and reorder layers for your NFT collection
- **Trait Management**: Upload and configure traits with rarity settings
- **Preview Panel**: Real-time preview of generated NFTs
- **Generation Controls**: Configure and start batch NFT generation

### Key Screens

1. **Welcome Screen** - Project creation and loading
2. **Layer Editor** - Layer organization and configuration
3. **Trait Upload** - Image upload and rarity configuration
4. **Generation Progress** - Real-time progress monitoring
5. **Export Options** - ZIP export and project packaging

### Navigation Flow

1. Start with project creation or loading
2. Configure layers and upload traits
3. Set output dimensions and project metadata
4. Preview individual NFTs
5. Generate complete collection
6. Export as ZIP package

> **TODO**: Add actual screenshots once UI is stable and production-ready.
