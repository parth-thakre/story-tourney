#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  printf 'docker is required\n' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf 'docker compose is required\n' >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/data" "$ROOT_DIR/tourneys"

export UID="${UID:-$(id -u)}"
export GID="${GID:-$(id -g)}"
export FRONTEND_BIND_IP="${FRONTEND_BIND_IP:-127.0.0.1}"

printf 'Starting Story Tourney\n'
printf 'Frontend bind: %s:9965\n' "$FRONTEND_BIND_IP"

docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --build

printf '\nLocal URL: http://%s:9965\n' "$FRONTEND_BIND_IP"
