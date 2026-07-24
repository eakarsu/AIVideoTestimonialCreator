#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mode="${1:-start}"
if [[ -f "$project_dir/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$project_dir/.env"
  set +a
fi
backend_port="${BACKEND_PORT:-${PORT:-3001}}"
frontend_port="${FRONTEND_PORT:-3000}"

export BACKEND_PORT="$backend_port"
if [[ "${NODE_ENV:-}" == "test" ]]; then
  export CLIENT_URL="${CLIENT_URL:-http://127.0.0.1:${frontend_port}}"
  export JWT_ISSUER="${JWT_ISSUER:-video-testimonial-creator-test}"
  export JWT_AUDIENCE="${JWT_AUDIENCE:-video-testimonial-api-test}"
  export RENDER_CALLBACK_SECRET="${RENDER_CALLBACK_SECRET:-${JWT_SECRET:-}}"
fi

case "$mode" in
  check)
    test -f "$project_dir/.env" || { echo "Missing .env (copy .env.example and configure it)." >&2; exit 1; }
    test -d "$project_dir/backend/node_modules" || { echo "Backend dependencies are not installed. Run scripts/bootstrap.sh explicitly." >&2; exit 1; }
    test -d "$project_dir/frontend/node_modules" || { echo "Frontend dependencies are not installed. Run scripts/bootstrap.sh explicitly." >&2; exit 1; }
    ;;
  migrate)
    exec "$project_dir/scripts/migrate.sh"
    ;;
  start)
    "$0" check
    if [[ "${MIGRATE_ON_START:-false}" == "true" || "${ALLOW_SCHEMA_MIGRATION:-false}" == "true" ]]; then
      "$project_dir/scripts/migrate.sh"
      ALLOW_DEVELOPMENT_SEED=true "$project_dir/scripts/seed-development.sh"
    fi
    backend_pid=""
    frontend_pid=""
    cleanup() { kill ${backend_pid:+"$backend_pid"} ${frontend_pid:+"$frontend_pid"} 2>/dev/null || true; }
    trap cleanup INT TERM EXIT
    (cd "$project_dir/frontend" && BACKEND_PORT="$backend_port" PORT="$frontend_port" BROWSER=none exec ./node_modules/.bin/react-scripts start) & frontend_pid=$!
    sleep 1
    kill -0 "$frontend_pid" 2>/dev/null || { echo "Frontend failed to start on port $frontend_port" >&2; exit 1; }
    (cd "$project_dir/backend" && exec node server.js) & backend_pid=$!
    api_ready=false
    for _ in {1..120}; do
      if curl --fail --silent --max-time 1 "http://127.0.0.1:${backend_port}/api/health" >/dev/null 2>&1; then api_ready=true; break; fi
      kill -0 "$backend_pid" 2>/dev/null || break
      sleep 0.25
    done
    [[ "$api_ready" == true ]] || { echo "Backend failed to become ready on port $backend_port" >&2; exit 1; }
    wait "$backend_pid" "$frontend_pid"
    ;;
  *)
    echo "Usage: ./start.sh [check|migrate|start]" >&2
    exit 64
    ;;
esac
