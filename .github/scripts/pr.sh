#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "main" ]]; then
  echo "Refusing to open a PR from 'main'."
  exit 1
fi

echo "Pushing '$branch' to origin..."
git push -u origin "$branch"

existing_pr="$(env -u GITHUB_TOKEN gh pr list --base main --head "$branch" --json number --jq '.[0].number // empty')"

if [[ -n "$existing_pr" ]]; then
  echo "PR already exists: #$existing_pr"
  env -u GITHUB_TOKEN gh pr view "$existing_pr" --web
  exit 0
fi

echo "Creating PR: $branch -> main"
env -u GITHUB_TOKEN gh pr create --base main --head "$branch" --fill --web
