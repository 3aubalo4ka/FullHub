#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$ROOT_DIR/data/fullhub.db"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/fullhub}"

mkdir -p "$BACKUP_DIR"
if [[ ! -f "$DB_PATH" ]]; then
  echo "DB not found: $DB_PATH" >&2
  exit 1
fi

STAMP="$(date +%F_%H-%M-%S)"
cp "$DB_PATH" "$BACKUP_DIR/fullhub_${STAMP}.db"

# keep last 14 backups
ls -1t "$BACKUP_DIR"/fullhub_*.db 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup created: $BACKUP_DIR/fullhub_${STAMP}.db"
