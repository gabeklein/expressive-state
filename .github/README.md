# Release Workflow Overview

This directory contains release automation and configuration for third-party contributors and maintainers.

## Source of truth

- Release workflow: [.github/workflows/publish.yml](workflows/publish.yml)
- Staging validation workflow: [.github/workflows/staging.yml](workflows/staging.yml)
- Main gate workflow: [.github/workflows/main-pr-gate.yml](workflows/main-pr-gate.yml)
- Release-please config: [.github/release-please-config.json](release-please-config.json)
- Release-please manifest: [.github/release-please-manifest.json](release-please-manifest.json)
- PR helper script: [.github/scripts/pr-to-staging.sh](scripts/pr-to-staging.sh)

## High-level behavior

- PR/push to `staging`: validation checks (`Test and Build` + `Coverage`), no auto-publish.
- Manual dispatch (`channel=canary`): canary publish from chosen ref.
- PR to `main`: must come from `staging` (enforced by gate check).
- Push to `main`: release PR automation and stable publish path.

## Stable release model

Stable releases are PR-based:

1. `main` runs release-please.
2. release-please opens/updates a release PR with version and changelog changes.
3. After release PR merge, publish runs from committed versions (`lerna publish from-package`).

## Canary release model

Canary is manual only and intended for `staging`.

- Trigger Actions workflow dispatch.
- Choose `channel=canary`.
- Provide optional `ref` (recommended: `staging`).

## Operational notes

- Stable source of truth is `main`.
- Use conventional commits for reliable release-please bump/changelog generation.
- Use `staging` as the integration lane for grouped changes before promotion to `main`.
- `staging` is protected: PR required, direct pushes blocked, `Test and Build` + `Coverage` required.
- `main` is protected and only accepts PRs from `staging`.

## Convenience command

Create a PR from your current branch to `staging`:

- `pnpm pr:staging`

For internal setup checklist, authorization status, and recovery playbook, see [.github/RELEASE-OPERATIONS.md](RELEASE-OPERATIONS.md).
