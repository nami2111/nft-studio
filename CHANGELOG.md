# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT License file
- CHANGELOG.md for version tracking
- ICP Blockchain and Juno to Technology Stack in About page
- Enhanced button hover effects with solid color transitions across all pages
- Improved navigation hover states with scale and shadow effects in About page

### Changed

- Updated README.md with current project structure and commands
- Enhanced documentation in docs/ directory to reflect current codebase
- Improved onboarding guide with accurate development workflow
- Disabled dark theme in app layout for consistent light theme experience
- Replaced shadow-based hover effects with solid color changes for better visibility
- Standardized button hover styles across Hero, About, and App pages

### Fixed

- Button hover visibility issues in light theme by using primary color backgrounds
- Inconsistent hover states between different button variants
- Theme conflicts interfering with button hover effects in app page

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
