#!/usr/bin/env bash
# Deploy the built Pomodoro app to your VPS via rsync.
#
# Usage:
#   VPS_HOST=your.vps.host DOMAIN=pomodoro.yourdomain.com ./deploy.sh
#
# Optional env vars:
#   VPS_USER     SSH user on the VPS (default: root)
#   REMOTE_PATH  Target directory on the VPS (default: /var/www/pomodoro)
#
# Tip: put VPS_HOST and DOMAIN in a local .env.deploy (gitignored) and
# `set -a; source .env.deploy; set +a; ./deploy.sh` to avoid retyping.

set -euo pipefail

VPS_USER="${VPS_USER:-root}"
REMOTE_PATH="${REMOTE_PATH:-/var/www/pomodoro}"

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "Set VPS_HOST=your.vps.host before running." >&2
  exit 1
fi

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
