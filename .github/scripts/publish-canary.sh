#!/usr/bin/env bash
set -euo pipefail

force_publish="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      force_publish="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" == "HEAD" ]]; then
  echo "Detached HEAD detected. Check out a branch and retry."
  exit 1
fi

echo "Pushing '$branch' to origin..."
git push -u origin "$branch"

echo "Dispatching canary publish for '$branch'..."
env -u GITHUB_TOKEN gh workflow run publish.yml --ref "$branch" -f channel=canary -f ref="$branch" -f force_publish="$force_publish"

sleep 2
run_id="$(env -u GITHUB_TOKEN gh run list --workflow=publish.yml --branch "$branch" --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
run_url="$(env -u GITHUB_TOKEN gh run list --workflow=publish.yml --branch "$branch" --event workflow_dispatch --limit 1 --json url --jq '.[0].url // empty')"

if [[ -n "$run_url" ]]; then
  echo "Canary publish started: $run_url"
else
  echo "Canary publish dispatched. Check Actions for status."
fi

if [[ -z "$run_id" ]]; then
  exit 0
fi

echo "Watching run $run_id..."
env -u GITHUB_TOKEN gh run watch "$run_id" --exit-status

echo ""
echo "Published canary versions:"
for pkg in $(pnpm lerna list --json --no-private 2>/dev/null | jq -r '.[].name'); do
  version="$(npm view "$pkg" dist-tags.canary 2>/dev/null || true)"
  if [[ -n "$version" ]]; then
    echo " - $pkg@$version"
  fi
done
