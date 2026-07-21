#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir/backend"
npm ci
cd "$project_dir/frontend"
npm ci
echo "Dependencies installed. Copy .env.example to .env and configure secrets before migration or startup."
