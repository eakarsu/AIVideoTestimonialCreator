#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
else
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD
fi
unset demo_credentials_email demo_credentials_password demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

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
