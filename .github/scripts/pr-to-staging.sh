#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "staging" || "$branch" == "main" ]]; then
  echo "Refusing to open a PR from '$branch'. Switch to a feature/integration branch first."
  exit 1
fi

echo "Pushing '$branch' to origin..."
git push -u origin "$branch"

existing_pr="$(env -u GITHUB_TOKEN gh pr list --base staging --head "$branch" --json number --jq '.[0].number // empty')"

if [[ -n "$existing_pr" ]]; then
  echo "PR already exists: #$existing_pr"
  env -u GITHUB_TOKEN gh pr view "$existing_pr" --web
  exit 0
fi

echo "Creating PR: $branch -> staging"
env -u GITHUB_TOKEN gh pr create --base staging --head "$branch" --fill
