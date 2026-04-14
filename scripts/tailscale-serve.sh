#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PORT="${APP_PORT:-9965}"
LOCAL_TARGET="${LOCAL_TARGET:-http://127.0.0.1:${APP_PORT}}"

if ! command -v tailscale >/dev/null 2>&1; then
  printf 'tailscale is required\n' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'node is required\n' >&2
  exit 1
fi

SELF_JSON="$(tailscale status --json)"
PARSED="$(printf '%s' "$SELF_JSON" | node "$ROOT_DIR/scripts/tailscale-status.mjs")"
TAILNET_SUFFIX="$(printf '%s\n' "$PARSED" | sed -n '1p')"
HOSTNAME="$(printf '%s\n' "$PARSED" | sed -n '2p')"
DNS_NAME="$(printf '%s\n' "$PARSED" | sed -n '3p')"
IPV4="$(printf '%s\n' "$PARSED" | sed -n '4p')"

if [[ -z "$HOSTNAME" && -z "$DNS_NAME" && -z "$IPV4" ]]; then
  printf 'could not determine this node\'s Tailscale address\n' >&2
  exit 1
fi

printf 'Publishing %s over Tailscale Serve\n' "$LOCAL_TARGET"
sudo tailscale serve --bg "$LOCAL_TARGET"

printf '\nReach it from trusted tailnet devices using one of:\n'
if [[ -n "$DNS_NAME" ]]; then
  printf '  http://%s\n' "$DNS_NAME"
fi
if [[ -n "$HOSTNAME" && -n "$TAILNET_SUFFIX" ]]; then
  printf '  http://%s.%s\n' "$HOSTNAME" "$TAILNET_SUFFIX"
fi
if [[ -n "$IPV4" ]]; then
  printf '  http://%s\n' "$IPV4"
  printf '  http://%s:%s\n' "$IPV4" "$APP_PORT"
fi

printf '\nCurrent serve config:\n'
tailscale serve status
