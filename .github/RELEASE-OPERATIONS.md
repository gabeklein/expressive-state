# Release Operations Notes

Internal release setup and recovery notes for this repository.

## Current authorization status

### GitHub (repo: `gabeklein/expressive-state`)

- [x] Actions enabled (`allowed_actions=all`)
- [x] Default workflow token permissions = `write`
- [x] Actions can approve PR reviews = `true`
- [x] `main` branch protection enabled (PR review required, linear history, force-push disabled, deletion disabled)
- [x] `main` requires check `Main PR source must be staging`
- [x] `staging` branch protection enabled (PR required, direct pushes blocked, required checks: `Test and Build`, `Coverage`)

### npm Trusted Publishing

- [x] Trusted Publisher configured for package `@expressive/state` (confirmed by maintainer)
- [x] Trusted Publisher configured for package `@expressive/react` (confirmed by maintainer)
- [ ] Verify first successful publish in Actions
- [ ] Optional hardening: disallow token-based publishing on npm package settings (OIDC-only policy)

## Workflow lifecycle details

1. Merge maintainer PR to `main`.
2. [.github/workflows/publish.yml](workflows/publish.yml) runs validation.
3. `release-pr` job runs release-please and opens/updates a release PR.
4. Version/changelog commits are on release-please branch, not on maintainer feature/staging source branch.
5. Merge release-please PR.
6. Next `main` run publishes stable from committed versions (`lerna publish from-package`).

Staging merge checks come from [.github/workflows/staging.yml](workflows/staging.yml).

Main source-branch enforcement comes from [.github/workflows/main-pr-gate.yml](workflows/main-pr-gate.yml).

Helper command for opening staging PRs:

- `pnpm pr:staging`

## Expected staging test and canary flow

1. Open PR from your working branch to `staging` (for example via `pnpm pr:staging`).
2. `Test and Build` and `Coverage` must pass before merge to `staging`.
3. After merge to `staging`, run canary manually from [.github/workflows/publish.yml](workflows/publish.yml) with `channel=canary` and `ref=staging`.

## Common CI failures and recovery

### 1) release-please does not open/update a PR

Symptoms:

- `release-pr` job succeeds but no release PR appears.

Likely causes:

- Commits are not conventional enough for bump detection.
- Existing open release PR already contains pending release metadata.

Recovery:

1. Confirm commit messages on `main` are conventional (`feat:`, `fix:`, etc.).
2. Check for existing open release PR and merge/update it.
3. Re-run workflow.

### 2) Stable publish runs but nothing publishes

Symptoms:

- `publish-stable` completes with no new package publish.

Likely causes:

- No new release commit merged yet.
- Manifest/package versions already aligned with published versions.

Recovery:

1. Merge the release-please PR first.
2. Trigger another run on `main` (or manual stable dispatch).

### 3) npm auth/trusted publisher failure

Symptoms:

- Publish step fails with npm auth or trusted publisher mismatch.

Likely causes:

- npm trusted publisher mapping does not match repo/workflow filename.
- OIDC permission missing.

Recovery:

1. Verify npm package trusted publisher points to repo `gabeklein/expressive-state` and workflow filename `publish.yml`.
2. Verify `permissions.id-token: write` in [.github/workflows/publish.yml](workflows/publish.yml).
3. Re-run after fix.

### 4) Canary publish failure

Symptoms:

- Manual canary run fails in `publish-canary`.

Likely causes:

- Wrong `ref` selected.
- Build/test failure on selected ref.

Recovery:

1. Re-run with intended `staging` ref.
2. Fix branch issues and push.
3. Re-run manual canary.

## Post-release verification checklist

- [ ] GitHub release PR merged cleanly
- [ ] Stable publish job succeeded
- [ ] New package version visible on npm for `@expressive/state`
- [ ] New package version visible on npm for `@expressive/react`
- [ ] Dependency alignment remains valid (`@expressive/react` dependency on `@expressive/state`)
