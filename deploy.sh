#!/usr/bin/env bash
# deploy.sh — Fuel Deployment: fuel-dev (dev) → ~/.local/fuel (staging) → /opt (prod)
set -euo pipefail

TARGET="${1:-staging}"
shift || true
SCRIPT_DIR="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"
DEV_SOURCE="$SCRIPT_DIR"
STAGE="$HOME/.local/fuel"
NODE_DEST="/opt/fuel"
PYTHON_DEST="/opt/fuel-python"
BACKUP_DIR="/opt/fuel_backups"
SERVICE="fuel.service"
PY_SERVICE="fuel-python.service"
UNIT_TARGET="/etc/systemd/system/fuel.service"
PY_UNIT_TARGET="/etc/systemd/system/fuel-python.service"
INSTALL_UNIT=false
INSTALL_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --install)
      INSTALL_UNIT=true
      ;;
    --install-only)
      INSTALL_UNIT=true
      INSTALL_ONLY=true
      ;;
    *)
      die "Invalid argument '$arg'. Supported: --install | --install-only"
      ;;
  esac
done

msg() { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

require_file() {
  local path="$1"
  local label="${2:-$1}"
  [[ -f "$path" ]] || die "❌ Missing $label at $path"
  msg "✅ $label present: $path"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-15}"
  local sleep_s="${4:-1}"
  local body=""
  local i

  for ((i = 1; i <= attempts; i++)); do
    if body="$(curl -fsS --max-time 2 "$url" 2>/dev/null)"; then
      msg "✅ $label healthy: $url"
      printf '%s\n' "$body"
      return 0
    fi
    sleep "$sleep_s"
  done

  die "❌ $label did not become healthy: $url"
}

print_systemd_failure_context() {
  local unit="$1"
  warn "⚠️ systemd status for $unit"
  sudo systemctl status "$unit" --no-pager || true
  warn "⚠️ recent journal for $unit"
  sudo journalctl -u "$unit" -n 40 --no-pager || true
}

read -r -d '' UNIT_CONTENT <<'EOF' || true
[Unit]
Description=Fuel Centre (Desktop Prod)
After=network.target

[Service]
Type=simple
User=alpha
Group=alpha
WorkingDirectory=/opt/fuel
Environment=PORT=7000
Environment=HOST=0.0.0.0
Environment=FUEL_STATIC_DIR=/opt/fuel
ExecStart=/usr/bin/npm run prod
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

read -r -d '' PY_UNIT_CONTENT <<'EOF' || true
[Unit]
Description=Fuel Centre Python Backend (Desktop Prod)
After=network.target

[Service]
Type=simple
User=alpha
Group=alpha
WorkingDirectory=/opt/fuel-python
Environment=DATABASE_URL=sqlite:////home/alpha/.aos/fuel/nutrition/nutrition.db
ExecStart=/opt/fuel-python/backend/.venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 4000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

install_prod_unit() {
  local current
  current="$(sudo cat "$UNIT_TARGET" 2>/dev/null || true)"
  if [[ "$current" == "$UNIT_CONTENT" ]]; then
    msg "✅ $UNIT_TARGET bereits aktuell."
    return
  fi

  msg "🧩 Installing systemd unit to $UNIT_TARGET"
  printf '%s\n' "$UNIT_CONTENT" | sudo tee "$UNIT_TARGET" >/dev/null
  current="$(sudo cat "$PY_UNIT_TARGET" 2>/dev/null || true)"
  if [[ "$current" != "$PY_UNIT_CONTENT" ]]; then
    msg "🧩 Installing systemd unit to $PY_UNIT_TARGET"
    printf '%s\n' "$PY_UNIT_CONTENT" | sudo tee "$PY_UNIT_TARGET" >/dev/null
  else
    msg "✅ $PY_UNIT_TARGET bereits aktuell."
  fi
  sudo systemctl daemon-reload
  msg "✅ Installed prod units and reloaded systemd."
}

if [[ "$TARGET" == "staging" ]]; then
  SOURCE="$DEV_SOURCE"
elif [[ "$TARGET" == "prod" ]]; then
  SOURCE="$STAGE"
else
  die "Invalid target '$TARGET'. Use: staging | prod"
fi

[[ -f "$SOURCE/package.json" ]] || die "Deployment source '$SOURCE' is not a Fuel checkout"

msg "🚀 Starting Fuel Deployment to $TARGET"
msg "📍 Using source checkout $SOURCE"

if [[ "$TARGET" == "staging" && ( "$INSTALL_UNIT" == true || "$INSTALL_ONLY" == true ) ]]; then
  die "--install and --install-only are only supported for target 'prod'"
fi

if [[ "$TARGET" == "staging" ]]; then
  # Cross-Repo-Aliase (@habits, @journal, @fitness/constants) lösen nur relativ
  # zu $SOURCE auf (Sibling-Repos liegen neben fuel-dev). Nach dem Build ist
  # dist/ standalone gebündelt — Stage/Prod brauchen die Sibling-Repos danach
  # nicht mehr.
  msg "🔨 Building Node UI in $SOURCE"
  (cd "$SOURCE" && npm run build:local > /dev/null)

  msg "🔨 Building frontend/ (React, für den Python-Server)"
  (cd "$SOURCE/frontend" && npm run build > /dev/null)

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

  msg "🩺 Verifying staged artifacts"
  require_file "$STAGE/dist/index.html" "Node staging dist"
  require_file "$STAGE/frontend/dist/index.html" "Python frontend dist"
  require_file "$STAGE/backend/requirements.txt" "Python backend requirements"

  msg "✅ Staging deployment complete."
  exit 0
fi

if [[ "$INSTALL_UNIT" == true ]]; then
  install_prod_unit
  if [[ "$INSTALL_ONLY" == true ]]; then
    msg "✅ Prod unit install complete."
    exit 0
  fi
fi

# ── 2. Prod: ~/.local/fuel → /opt ────────────────────────────────────────────

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

msg "📦 Syncing Node code $SOURCE → $NODE_DEST"
sudo rsync -av --delete \
  --exclude "catalogs" \
  --exclude "backend" \
  --exclude "frontend" \
  "$SOURCE/" "$NODE_DEST/"

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

msg "📦 Syncing backend/ (Python) $SOURCE/backend → $PYTHON_DEST/backend"
rsync -av --delete \
  --exclude ".venv" --exclude "__pycache__" --exclude "*.pyc" \
  --exclude ".env" --exclude "logs" \
  "$SOURCE/backend/" "$PYTHON_DEST/backend/"
msg "📦 Syncing frontend/ (React) $SOURCE/frontend → $PYTHON_DEST/frontend"
rsync -av --delete \
  --exclude "node_modules" \
  "$SOURCE/frontend/" "$PYTHON_DEST/frontend/"

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

if systemctl list-unit-files "$PY_SERVICE" >/dev/null 2>&1; then
  msg "🔄 Restarting $PY_SERVICE"
  sudo systemctl restart "$PY_SERVICE"
else
  warn "⚠️ $PY_SERVICE not found. Run deploy.sh prod --install once to install it."
fi

msg "🩺 Verifying production runtime"
if systemctl list-unit-files "$SERVICE" >/dev/null 2>&1; then
  if ! sudo systemctl is-active --quiet "$SERVICE"; then
    print_systemd_failure_context "$SERVICE"
    die "❌ $SERVICE is not active after deploy"
  fi
fi

if systemctl list-unit-files "$PY_SERVICE" >/dev/null 2>&1; then
  if ! sudo systemctl is-active --quiet "$PY_SERVICE"; then
    print_systemd_failure_context "$PY_SERVICE"
    die "❌ $PY_SERVICE is not active after deploy"
  fi
fi

if ! wait_for_http "http://127.0.0.1:7000/health" "Prod Node health" >/dev/null; then
  print_systemd_failure_context "$SERVICE"
  die "❌ Prod Node healthcheck failed"
fi

if ! wait_for_http "http://127.0.0.1:4000/health" "Prod Python health" >/dev/null; then
  print_systemd_failure_context "$PY_SERVICE"
  die "❌ Prod Python healthcheck failed"
fi

if ! wait_for_http "http://127.0.0.1:7000/v4/health" "Prod v4 proxy health" >/dev/null; then
  warn "⚠️ Node prod is up, but /v4/health failed."
  die "❌ Prod v4 proxy healthcheck failed"
fi

msg "✅ backend/ (Python) + frontend/ (React) deployed to $PYTHON_DEST."
msg "✅ Deployment complete."
