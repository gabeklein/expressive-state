# CI/CD Workflow Overview

This directory contains release automation and CI/CD configuration.

## Source of truth

- Main gate and release PR automation: [.github/workflows/merge.yml](workflows/merge.yml)
- Staging validation: [.github/workflows/staging.yml](workflows/staging.yml)
- Stable/canary publishing: [.github/workflows/publish.yml](workflows/publish.yml)
- Release-please config: [.github/release-please-config.json](release-please-config.json)
- Release-please manifest: [.github/release-please-manifest.json](release-please-manifest.json)
- PR helper script: [.github/scripts/pr-to-staging.sh](scripts/pr-to-staging.sh)

## High-level flow

1. Feature branches merge into `staging` after staging checks pass.
2. A PR from `staging` to `main` must pass the main gate checks.
3. On push to `main`, `merge.yml` runs release-please to open/update a release PR.
4. Merging the release PR triggers stable publish from `main` in `publish.yml`.
5. Canary publish is manual via workflow dispatch in `publish.yml`.

## Workflow details

### `staging.yml`

- Trigger: PRs to `staging` and pushes to `staging`.
- Jobs: `Build` and `Coverage`.

### `merge.yml`

- Trigger: PRs to `main` and pushes to `main`.
- PR jobs enforce:
  - source branch policy (`staging` or `release-please--*`)
  - ancestry protection (`main` must be contained in `staging` for staging promotions)
  - test/build validation
- Push job opens/updates the release PR with release-please.

### `publish.yml`

- Trigger:
  - merged PRs to `main` (`pull_request: closed`) for stable publish
  - manual dispatch for stable/canary
- Stable publish runs only for merged `release-please--*` PRs (or manual stable dispatch).
- Canary publish runs only via manual dispatch.

## Operational notes

- Stable source of truth is `main`.
- Use conventional commits for reliable release-please versioning/changelog generation.
- Use `staging` as the integration lane before promotion to `main`.

## Convenience command

Create a PR from your current branch to `staging`:

- `pnpm pr:staging`
