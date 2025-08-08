#!/usr/bin/env bash
set -euo pipefail

echo "Verifying lockfile integrity..."

if [ -f pnpm-lock.yaml ]; then
  echo "Detected pnpm-lock.yaml; verifying with pnpm via frozen lockfile..."
  npx pnpm install --frozen-lockfile
elif [ -f package-lock.json ]; then
  echo "Detected package-lock.json; verifying with npm ci..."
  npm ci
else
  echo "No recognized lockfile present (pnpm-lock.yaml or package-lock.json). Skipping verification."
  exit 0
fi

if ! git diff --quiet; then
  echo "Lockfile changed after install. Please commit the updated lockfile." >&2
  exit 1
fi

echo "Lockfile is up to date."
exit 0
