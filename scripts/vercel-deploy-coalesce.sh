#!/usr/bin/env bash
set -euo pipefail

EVENT_NAME="${EVENT_NAME:-${GITHUB_EVENT_NAME:-push}}"
COMMIT_SHA="${COMMIT_SHA:-${GITHUB_SHA:-}}"
BRANCH_REF="${BRANCH_REF:-${GITHUB_REF_NAME:-main}}"
WAIT_SECONDS="${DEPLOY_COALESCE_SECONDS:-90}"

write_output() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "${key}=${value}" >> "$GITHUB_OUTPUT"
  fi
  echo "${key}=${value}"
}

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  write_output should_deploy true
  exit 0
fi

if [ -z "$COMMIT_SHA" ]; then
  write_output should_deploy false
  exit 0
fi

sleep "$WAIT_SECONDS"
git fetch --quiet origin "$BRANCH_REF"
TIP="$(git rev-parse "origin/${BRANCH_REF}")"

if [ "$TIP" != "$COMMIT_SHA" ]; then
  write_output should_deploy false
  exit 0
fi

write_output should_deploy true
