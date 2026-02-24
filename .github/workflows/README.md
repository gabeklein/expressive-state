# CI/CD Workflow Overview

This directory contains release automation and CI/CD configuration.

## Source of truth

- CI and release PR automation: [.github/workflows/ci.yml](workflows/ci.yml)
- Stable/canary publishing: [.github/workflows/publish.yml](workflows/publish.yml)
- Release-please config: [.github/release-please-config.json](release-please-config.json)
- Release-please manifest: [.github/release-please-manifest.json](release-please-manifest.json)
- PR helper script: [.github/scripts/pr.sh](scripts/pr.sh)

## High-level flow

1. Feature branches open PRs directly to `main`.
2. CI runs build+test on all PRs to `main`.
3. On push to `main`, `ci.yml` runs release-please to open/update a release PR.
4. Release-please PRs get CI checks via workflow dispatch re-trigger.
5. Merging the release PR triggers stable publish from `main` in `publish.yml`.
6. Canary publish is manual via workflow dispatch in `publish.yml`.

## Workflow details

### `ci.yml`

- Trigger: PRs to `main`, pushes to `main`, and workflow dispatch.
- PR/dispatch jobs: test and build validation.
- Push job: opens/updates the release PR with release-please, then dispatches CI on the release PR.

### `publish.yml`

- Trigger:
  - merged PRs to `main` (`pull_request: closed`) for stable publish
  - manual dispatch for stable/canary
- Stable publish runs only for merged `release-please--*` PRs (or manual stable dispatch).
- Canary publish runs only via manual dispatch.

## Operational notes

- Source of truth is `main`.
- Use conventional commits for reliable release-please versioning/changelog generation.

## Convenience command

Create a PR from your current branch to `main`:

- `pnpm pr`
