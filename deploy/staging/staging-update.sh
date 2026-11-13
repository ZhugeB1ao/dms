#!/bin/bash
# ==============================================================================
# Tu cap nhat staging DMS: keo image moi tu GHCR va chi khoi dong lai service co thay doi.
# Chay dinh ky bang launchd (macOS, xem com.dms.staging-update.plist.example) hoac cron (Linux):
#   */2 * * * * /duong/dan/toi/deploy/staging/staging-update.sh
# Chay tay de thu:  bash deploy/staging/staging-update.sh
#
# Bien moi truong co the doi (khong bat buoc):
#   STAGING_DIR   thu muc chua docker-compose.yml va .env.staging (mac dinh: thu muc cua script)
#   LOG_FILE      file log (mac dinh: $STAGING_DIR/logs/update.log)
# ==============================================================================
set -uo pipefail

STAGING_DIR="${STAGING_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.staging"
LOG_FILE="${LOG_FILE:-$STAGING_DIR/logs/update.log}"
LOCK_DIR="$STAGING_DIR/.update.lock"

# launchd/cron khong co PATH day du: them duong dan docker cua Docker Desktop / Homebrew / Linux
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin"

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"; }

# Khong chay chong len nhau (lan truoc chua xong thi bo qua lan nay)
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR"' EXIT

# Docker chua chay thi bo qua, lan sau thu lai
if ! docker info >/dev/null 2>&1; then
  log "Docker chua chay, bo qua."
  exit 0
fi

cd "$STAGING_DIR" || { log "Khong tim thay $STAGING_DIR"; exit 1; }

if [ ! -f "$ENV_FILE" ]; then
  log "LOI: chua co $ENV_FILE (cp .env.staging.example .env.staging roi dien gia tri)."
  exit 1
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

# Ghi lai image dang chay de biet co thay doi hay khong
before="$("${COMPOSE[@]}" images -q 2>/dev/null | sort | tr '\n' ' ')"

if ! "${COMPOSE[@]}" pull --quiet >> "$LOG_FILE" 2>&1; then
  log "LOI: pull that bai (kiem tra mang, docker login ghcr.io, hoac image chua co tren GHCR)."
  exit 1
fi

if ! "${COMPOSE[@]}" up -d --remove-orphans >> "$LOG_FILE" 2>&1; then
  log "LOI: up -d that bai."
  exit 1
fi

after="$("${COMPOSE[@]}" images -q 2>/dev/null | sort | tr '\n' ' ')"

if [ "$before" != "$after" ]; then
  log "DA CAP NHAT staging sang image moi."
  # Don image cu khong con dung de khong day o dia
  docker image prune -f >/dev/null 2>&1
fi
