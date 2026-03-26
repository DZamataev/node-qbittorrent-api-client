#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-lib.sh"

main() {
  trap test_cleanup EXIT
  test_start_qbittorrent

  node "$TEST_CLIENT_JS" version
  node "$TEST_CLIENT_JS" preferences >/dev/null
  node "$TEST_CLIENT_JS" list >/dev/null

  echo "Smoke test passed"
}

main "$@"
