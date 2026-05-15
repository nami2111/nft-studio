# Comment and Formatting Standardization (Historical)

> **Note**: This document records historical work. The `standardize-comments` script no longer exists
> and `pnpm` has been replaced by `vp` as the build tool. See `docs/onboarding.md` and
> `AGENTS.md` for the current development workflow. All formatting is now handled by Oxfmt (`vp fmt`)
> and linting by Oxlint (`vp lint`).

## Summary

This documents a historical effort to improve comment consistency. The current project uses Oxfmt and Oxlint
for code quality, run via the `vp` CLI. See `docs/coding-standards.md` for current style guidelines.

## Historical Usage (No Longer Valid)

The following commands no longer exist and are retained for historical reference only:

```
pnpm standardize-comments   # Script removed
pnpm format                 # Replaced by: vp fmt
pnpm lint                   # Replaced by: vp lint
pnpm check                  # Replaced by: vp check
```

## Current Commands

Refer to `AGENTS.md` for the authoritative list of current commands:

```
vp fmt          # Format with Oxfmt
vp lint         # Lint with Oxlint
vp check        # Format + lint + type check
vp test         # Run all tests
```
