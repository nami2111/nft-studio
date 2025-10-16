# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT License file
- CHANGELOG.md for version tracking
- ICP Blockchain and Juno to Technology Stack in About page
- Enhanced button hover effects with scale animations and solid color transitions
- Improved navigation hover states with scale and shadow effects in About page
- Custom modal component to replace bits-ui Dialog system
- Viewport-based modal positioning for consistent centering regardless of page length
- Visual distinction between selected and unselected traits in ruler rules with icons and colors
- Enhanced trait selection UI with green checkmarks for allowed traits and red X marks for forbidden traits
- Color-coded trait sections (green for allowed, red for forbidden) with better visual hierarchy

### Changed

- Updated README.md with current project structure and commands
- Enhanced documentation in docs/ directory to reflect current codebase
- Improved onboarding guide with accurate development workflow
- Disabled dark theme in app layout for consistent light theme experience
- Replaced shadow-based hover effects with solid color changes for better visibility
- Standardized button hover styles across Hero, About, and App pages
- Updated dialog styling to use solid white backgrounds with dark borders for better contrast
- Removed CSS overrides that were preventing button hover effects from working properly
- Moved promote-to-ruler crown icon from trait name area to top-right corner of trait cards
- Simplified modal trigger pattern (direct onclick instead of DialogTrigger)
- Improved modal responsive sizing and mobile-friendly margins

### Changed

- Updated README.md with current project structure and commands
- Enhanced documentation in docs/ directory to reflect current codebase
- Improved onboarding guide with accurate development workflow
- Disabled dark theme in app layout for consistent light theme experience
- Replaced shadow-based hover effects with solid color changes for better visibility
- Standardized button hover styles across Hero, About, and App pages
- Updated dialog styling to use solid white backgrounds with dark borders for better contrast
- Removed CSS overrides that were preventing button hover effects from working properly

### Fixed

- Button hover visibility issues in light theme by using primary color backgrounds
- Inconsistent hover states between different button variants
- Theme conflicts interfering with button hover effects in app page
- Button hover styles not activating properly due to conflicting CSS overrides
- Popup dialog transparency issues causing poor readability
- Dialog borders and text not visible in light theme
- Modal positioning conflicts with bits-ui Dialog causing inconsistent centering
- Modal positioning relative to page content instead of viewport causing off-screen dialogs on long pages
- Crown icon alignment issues in trait cards (promote to ruler icon not aligned with edit/trash icons)
- Duplicate crown icon display when trait type is ruler
- Trait selection visual ambiguity between selected and unselected states in ruler rules
- Modal z-index conflicts preventing proper layering above page content

## [0.2.1] - 2024-10-06

### Added

- Svelte 5 runes implementation for reactive state management
- Modular store architecture with single responsibility principle
- Comprehensive error handling utilities
- Web worker pool management for background processing
- LRU image caching system
- Bulk trait operations (edit, rename, delete)
- Drag & drop file upload with progress tracking
- PWA support with service worker
- ICP blockchain integration with Juno hosting

### Changed

- Migrated from Svelte stores to Svelte 5 runes ($state, $derived, $effect)
- Refactored components into focused sub-modules
- Enhanced project structure with better separation of concerns
- Updated to Tailwind CSS 4
- Improved TypeScript strict mode compliance
- Optimized build process with comment removal

### Fixed

- Memory management in image processing
- Worker communication error handling
- File validation and security
- Loading state management

### Deprecated

- Legacy Svelte store patterns (migrated to runes)

## [0.2.0] - 2024-09-XX

### Added

- Initial NFT generation functionality
- Layer and trait management system
- Real-time preview system
- ZIP export functionality
- Project save/load capabilities

### Changed

- Complete rewrite using SvelteKit 2
- Migrated to TypeScript strict mode
- Updated UI component library to bits-ui

## [0.1.0] - 2025-XX-XX

### Added

- Initial project setup
- Basic UI framework
- Project structure foundation
