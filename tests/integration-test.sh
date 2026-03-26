#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-lib.sh"
TEST_TAG="integration-test"
TEST_MAGNET='magnet:?xt=urn:btih:3b245504cf5f11bbdb8f733fb7b7bf3480f7f89e&dn=ubuntu-24.04.2-desktop-amd64.iso'
TEST_HASH="3b245504cf5f11bbdb8f733fb7b7bf3480f7f89e"

wait_for_torrent() {
  local attempts=0

  while [[ "$attempts" -lt 20 ]]; do
    local list_json
    list_json="$(node "$TEST_CLIENT_JS" list --tag "$TEST_TAG")"

    if LIST_JSON="$list_json" TEST_HASH="$TEST_HASH" node <<'EOF'
const list = JSON.parse(process.env.LIST_JSON);
const hash = process.env.TEST_HASH.toLowerCase();
process.exit(list.some(item => String(item.hash).toLowerCase() === hash) ? 0 : 1);
EOF
    then
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "Torrent was not found in list output" >&2
  return 1
}

main() {
  trap test_cleanup EXIT
  test_start_qbittorrent

  node "$TEST_CLIENT_JS" add "$TEST_MAGNET" --tags "$TEST_TAG" >/dev/null
  wait_for_torrent

  node "$TEST_CLIENT_JS" info "$TEST_HASH" >/dev/null
  node "$TEST_CLIENT_JS" delete "$TEST_HASH" >/dev/null

  echo "Integration test passed"
}

main "$@"
