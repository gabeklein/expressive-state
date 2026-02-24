# CI/CD Workflow Overview

## Files

- CI: [pr.yml](pr.yml) — runs on PRs to `main`
- Publishing: [publish.yml](publish.yml) — runs on push to `main` and manual dispatch
- PR helper: [.github/scripts/pr.sh](../scripts/pr.sh)

## Flow

1. Feature branch → `pnpm pr` → opens PR to `main` (opens in browser for review)
2. CI runs build+test and posts a version preview comment on the PR
3. Merge to `main` → publish checks for changed packages, versions, and publishes to npm

## Workflows

### `pr.yml`
Trigger: PRs to `main`.

- **Build** (`validate`): runs tests and build. Required check for branch protection.
- **Version preview** (`version-preview`): computes the next version from conventional commits and posts/updates a PR comment. Shows "No package changes" if nothing releasable.

### `publish.yml`
Trigger: push to `main`, or manual dispatch.

- **Check for changes** (`check`): runs `lerna changed` — if nothing changed, skips publish entirely.
- **Publish Stable** (`publish-stable`): runs on push (when changes detected) or manual `stable` dispatch. Builds, tests, runs `lerna version --conventional-commits`, then `lerna publish from-package`.
- **Publish Canary** (`publish-canary`): manual dispatch only (`channel: canary`). Publishes with `--canary` dist-tag.

## Manual dispatch options

`publish.yml` → Run workflow:
- `channel`: `stable` or `canary`
- `ref`: optional branch/SHA to publish from
- `force_publish`: skip changed-package check for canary

## Branch protection

`main` requires the **Build** check to pass. `github-actions[bot]` is allowed to bypass for version bump commits from the publish bot.
