#!/usr/bin/env bash
# Deploy the built Pomodoro app to the Contabo VPS via rsync.
#
# Usage:
#   DOMAIN=pomodoro.yourdomain.com ./deploy.sh
#
# Requires: ssh access to root@VPS_HOST, Caddy installed on the VPS,
# and a Caddyfile entry for $DOMAIN -> /var/www/pomodoro (see README).

set -euo pipefail

VPS_HOST="${VPS_HOST:-164.68.102.157}"
VPS_USER="${VPS_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/pomodoro}"

if [[ -z "${DOMAIN:-}" ]]; then
  echo "Set DOMAIN=pomodoro.yourdomain.com before running." >&2
  exit 1
fi

echo "Building..."
npm run build

echo "Ensuring remote path $REMOTE_PATH exists..."
ssh "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_PATH"

echo "Syncing dist/ to $VPS_USER@$VPS_HOST:$REMOTE_PATH"
rsync -avz --delete dist/ "$VPS_USER@$VPS_HOST:$REMOTE_PATH/"

echo "Done. App should be live at https://$DOMAIN"
