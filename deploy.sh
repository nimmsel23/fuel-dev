#!/usr/bin/env bash
# deploy.sh — Fuel Deployment: fuel-dev (dev) → ~/.local/fuel (staging) → /opt (prod)
set -euo pipefail

SOURCE="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"
STAGE="$HOME/.local/fuel"
NODE_DEST="/opt/fuel"
PYTHON_DEST="/opt/fuel-python"
BACKUP_DIR="/opt/fuel_backups"
SERVICE="fuel.service"

msg() { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

msg "🚀 Starting Fuel Deployment"

# ── 0. Build in SOURCE ────────────────────────────────────────────────────────
# Cross-Repo-Aliase (@habits, @journal, @fitness/constants) lösen nur relativ
# zu $SOURCE auf (Sibling-Repos liegen neben $SOURCE). Nach dem Build ist
# dist/ standalone gebündelt — Stage/Prod brauchen die Sibling-Repos danach
# nicht mehr.
msg "🔨 Building Node UI in $SOURCE"
(cd "$SOURCE" && npm run build:local > /dev/null)

msg "🔨 Building frontend/ (React, für den Python-Server)"
(cd "$SOURCE/frontend" && npm run build > /dev/null)

# ── 1. Staging: fuel-dev → ~/.local/fuel (git-versioniert, auto-commit) ─────
msg "📦 Staging: $SOURCE → $STAGE"
mkdir -p "$STAGE"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".venv" --exclude "__pycache__" --exclude "*.pyc" \
  --exclude "data" \
  --exclude "dev-dist" \
  --exclude ".firebase" \
  --exclude ".archiv" \
  --exclude "*.bak" \
  --exclude ".claude" \
  --exclude "*.log" \
  --exclude ".env" --exclude ".env.*" \
  "$SOURCE/" "$STAGE/"

if [[ -d "$STAGE/.git" ]]; then
  (
    cd "$STAGE"
    git add -A
    if ! git diff --cached --quiet; then
      git commit -q -m "deploy: sync from fuel-dev $(date +%Y-%m-%dT%H:%M:%S)"
      msg "✅ ~/.local/fuel committed ($(git rev-parse --short HEAD))"
    else
      msg "ℹ️  ~/.local/fuel unverändert, kein neuer Commit"
    fi
  )
else
  warn "⚠️ $STAGE ist kein Git-Repo — Staging-Historie nicht versioniert"
fi

# ── 2. Prod: Node ($STAGE → $NODE_DEST) ──────────────────────────────────────

timestamp=$(date +%Y%m%d_%H%M%S)
backup_path="$BACKUP_DIR/fuel_$timestamp"

if [[ -d "$NODE_DEST" ]]; then
  msg "📦 Creating versioned backup: $backup_path"
  sudo mkdir -p "$BACKUP_DIR"
  sudo cp -a "$NODE_DEST" "$backup_path"
fi

if [[ ! -d "$NODE_DEST" ]]; then
  msg "📂 Creating target directory $NODE_DEST"
  sudo mkdir -p "$NODE_DEST"
  sudo chown "$(id -u):$(id -g)" "$NODE_DEST"
fi

msg "📦 Syncing Node code $STAGE → $NODE_DEST"
sudo rsync -av --delete \
  --exclude "catalogs" \
  --exclude "backend" \
  --exclude "frontend" \
  "$STAGE/" "$NODE_DEST/"

# Laufzeit-Daten NICHT kopieren, sondern symlinken (Katalog-JSONs sind
# git-tracked, aber prod schreibt live per POST /nutrition/catalog rein —
# eine rsync --delete-Kopie hätte das beim nächsten Deploy überschrieben).
# Kanonischer Ort bleibt fuel-dev (dev), nicht die Staging-Kopie.
if [[ -e "$NODE_DEST/catalogs" && ! -L "$NODE_DEST/catalogs" ]]; then
  rm -rf "$NODE_DEST/catalogs"
fi
ln -sfn "$SOURCE/catalogs" "$NODE_DEST/catalogs"
msg "🔗 $NODE_DEST/catalogs → $SOURCE/catalogs (Daten-Symlink)"

msg "📦 Installing Node server dependencies"
sudo chown -R "$(id -u):$(id -g)" "$NODE_DEST"
(cd "$NODE_DEST" && npm ci --silent --include=dev)

if systemctl list-unit-files "$SERVICE" >/dev/null 2>&1; then
  msg "🔄 Restarting $SERVICE"
  sudo systemctl restart "$SERVICE"
else
  warn "⚠️ $SERVICE not found. Skipping restart."
fi

msg "✅ Node deployed to $NODE_DEST."

# ── 3. Prod: Python ($STAGE/{backend,frontend} → $PYTHON_DEST) ──────────────

if [[ ! -d "$PYTHON_DEST" ]]; then
  msg "📂 Creating target directory $PYTHON_DEST"
  sudo mkdir -p "$PYTHON_DEST"
  sudo chown "$(id -u):$(id -g)" "$PYTHON_DEST"
fi

msg "📦 Syncing backend/ (Python) $STAGE/backend → $PYTHON_DEST/backend"
rsync -av --delete \
  --exclude ".venv" --exclude "__pycache__" --exclude "*.pyc" \
  --exclude ".env" --exclude "logs" \
  "$STAGE/backend/" "$PYTHON_DEST/backend/"
msg "📦 Syncing frontend/ (React) $STAGE/frontend → $PYTHON_DEST/frontend"
rsync -av --delete \
  --exclude "node_modules" \
  "$STAGE/frontend/" "$PYTHON_DEST/frontend/"

# Laufzeit-Daten: DATABASE_URL zeigt (siehe backend/core/config.py) per
# Default auf die laufende Postgres (fuel_tracker_db, :5432) — ein Netzwerk-
# Service, kein Datei-Symlink nötig, automatisch von jeder Stage aus gleich
# erreichbar. Fällt Postgres aus, greift der SQLite-Fallback auf
# ~/.aos/fuel/nutrition.db (home-relativ, ebenfalls stage-unabhängig).

if [[ ! -d "$PYTHON_DEST/backend/.venv" ]]; then
  msg "🐍 Creating venv + installing Python dependencies"
  python3 -m venv "$PYTHON_DEST/backend/.venv"
fi
"$PYTHON_DEST/backend/.venv/bin/pip" install -q -r "$PYTHON_DEST/backend/requirements.txt"

warn "⚠️ Kein systemd-Service für Python bisher — Start/Stop weiterhin über fuel-devctl (Popen+PIDFILE), kein automatischer Restart hier."

msg "✅ backend/ (Python) + frontend/ (React) deployed to $PYTHON_DEST."
msg "✅ Deployment complete."
