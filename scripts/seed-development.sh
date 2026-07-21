#!/usr/bin/env bash
set -euo pipefail
if [[ "${NODE_ENV:-development}" == "production" ]]; then
  echo "Refusing to run the development identity seed in production" >&2
  exit 1
fi
case "${ALLOW_DEVELOPMENT_SEED:-}" in
  yes|true) ;;
  *) echo "Refusing to seed without ALLOW_DEVELOPMENT_SEED=yes (or true)" >&2; exit 1 ;;
esac
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/scripts/seed-development.js"
