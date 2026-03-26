#!/usr/bin/env bash

set -euo pipefail

TEST_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$TEST_LIB_DIR/.." && pwd)"
TEST_COMPOSE_FILE="$TEST_LIB_DIR/docker-compose.test.yml"
TEST_COOKIE_FILE="$TEST_LIB_DIR/.qbt-api-cookie.test"
TEST_CONTAINER_NAME="node-qbittorrent-api-client-test"
TEST_WEBUI_URL="http://127.0.0.1:18080"
TEST_WEBUI_USERNAME="admin"
TEST_CLIENT_JS="$PACKAGE_ROOT/node-qbittorrent-api-client.js"

test_cleanup() {
  docker compose -f "$TEST_COMPOSE_FILE" down >/dev/null 2>&1 || true
  rm -f "$TEST_COOKIE_FILE"
}

test_extract_password() {
  docker logs "$TEST_CONTAINER_NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \(.*\)$/\1/p' | tail -n 1
}

test_wait_for_password() {
  local attempts=0

  while [[ "$attempts" -lt 30 ]]; do
    local password
    password="$(test_extract_password)"
    if [[ -n "$password" ]]; then
      printf '%s\n' "$password"
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 2
  done

  echo "Failed to extract temporary WebUI password from container logs" >&2
  return 1
}

test_setup_env() {
  local password="$1"

  export QBT_API_URL="$TEST_WEBUI_URL"
  export QBT_API_USERNAME="$TEST_WEBUI_USERNAME"
  export QBT_API_PASSWORD="$password"
  export QBT_API_COOKIE_FILE="$TEST_COOKIE_FILE"
}

test_start_qbittorrent() {
  docker compose -f "$TEST_COMPOSE_FILE" up -d
  test_setup_env "$(test_wait_for_password)"
}
