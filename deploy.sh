#!/usr/bin/env bash
# deploy.sh — Fuel Deployment: fuel-dev (dev) → ~/.local/fuel (staging) → /opt (prod)
set -euo pipefail

TARGET="${1:-staging}"
shift || true
SCRIPT_DIR="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" && pwd)"
DEV_SOURCE="$SCRIPT_DIR"

# Echtes User-Home auflösen, nicht blind $HOME: unter pkexec ist $HOME=/root,
# unter sudo je nach Policy ebenfalls — dann zeigt STAGE auf /root/.local/fuel
# und der Deploy bricht mit "not a Fuel checkout" ab.
if [[ -n "${PKEXEC_UID:-}" ]]; then
  USER_HOME="$(getent passwd "$PKEXEC_UID" | cut -d: -f6)"
elif [[ -n "${SUDO_USER:-}" ]]; then
  USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  USER_HOME="$HOME"
fi
: "${USER_HOME:=$HOME}"
STAGE="$USER_HOME/.local/fuel"
NODE_DEST="/opt/fuel"
PYTHON_DEST="/opt/fuel-python"
SERVICE="fuel.service"
PY_SERVICE="fuel-python.service"
UNIT_TARGET="/etc/systemd/system/fuel.service"
PY_UNIT_TARGET="/etc/systemd/system/fuel-python.service"
INSTALL_UNIT=false
INSTALL_ONLY=false
BUILD=false
# Staging-Service (user-scope, analog fitness-preview.service :8100)
STAGE_SERVICE="fuel-preview.service"
STAGE_PORT=8700
STAGE_UNIT_TARGET="$USER_HOME/.config/systemd/user/$STAGE_SERVICE"
# Firestore-Sync als eigener Dienst (scripts/sync-daemon.mjs, ohne Fastify)
SYNC_SERVICE="fuel-sync.service"
SYNC_UNIT_TARGET="$USER_HOME/.config/systemd/user/$SYNC_SERVICE"

for arg in "$@"; do
  case "$arg" in
    --install)
      INSTALL_UNIT=true
      ;;
    --install-only)
      INSTALL_UNIT=true
      INSTALL_ONLY=true
      ;;
    --build)
      BUILD=true
      ;;
    *)
      die "Invalid argument '$arg'. Supported: --install | --install-only | --build"
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

# systemctl --user auch dann, wenn das Skript unter sudo/pkexec läuft
user_systemctl() {
  if [[ "$(id -u)" == "0" && -n "${PKEXEC_UID:-}${SUDO_USER:-}" ]]; then
    local uid="${PKEXEC_UID:-$(id -u "$SUDO_USER")}"
    sudo -u "#$uid" XDG_RUNTIME_DIR="/run/user/$uid" systemctl --user "$@"
  else
    systemctl --user "$@"
  fi
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
ExecStart=/usr/bin/pnpm run prod
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

# Staging-Unit: user-scope, wie fitness-preview.service. Der Firestore-Sync läuft
# NICHT hier, sondern im eigenen Dienst fuel-sync.service (sonst zwei Instanzen auf
# demselben Datenordner). Keine Push-Reminder: der Datenordner wird mit Prod geteilt.
read -r -d '' STAGE_UNIT_CONTENT <<UNIT || true
[Unit]
Description=Fuel Centre Staging Service (Node :$STAGE_PORT)
After=network.target

[Service]
Type=simple
WorkingDirectory=$STAGE
Environment=NODE_ENV=production
Environment=PORT=$STAGE_PORT
Environment=HOST=127.0.0.1
Environment=FUEL_STATIC_DIR=$STAGE/dist
Environment=FUEL_BUILD_DIR=$STAGE/dist
Environment=FUEL_ENABLE_FIRESTORE_SYNC=0
Environment=FUEL_DISABLE_PUSH_SCHEDULER=1
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

# Sync-Daemon: einziger Besitzer des Firestore-Syncs (stündlicher Multi-UID-Pull
# + Realtime-Katalog-Listener). Dev und Prod synchronisieren nie.
read -r -d '' SYNC_UNIT_CONTENT <<UNIT || true
[Unit]
Description=Fuel Firestore Sync (Cloud -> ~/.aos/fuel, ohne Fastify)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$STAGE
Environment=NODE_ENV=production
ExecStart=/usr/bin/node scripts/sync-daemon.mjs
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
UNIT

# install_user_unit <Name> <Ziel> <Inhalt> — schreibt die Unit nur bei Änderung
install_user_unit() {
  local name="$1" target="$2" content="$3" current
  current="$(cat "$target" 2>/dev/null || true)"
  if [[ "$current" == "$content" ]]; then
    msg "🧩 Unit $name bereits aktuell"
    return
  fi
  msg "🧩 Schreibe/aktualisiere systemd Unit $name"
  mkdir -p "$(dirname "$target")"
  printf '%s\n' "$content" > "$target"
  user_systemctl daemon-reload
}

install_stage_unit() {
  install_user_unit "$STAGE_SERVICE" "$STAGE_UNIT_TARGET" "$STAGE_UNIT_CONTENT"
  install_user_unit "$SYNC_SERVICE" "$SYNC_UNIT_TARGET" "$SYNC_UNIT_CONTENT"
}

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
if [[ "$TARGET" == "prod" && "$BUILD" == true ]]; then
  die "--build gilt nur für target 'staging'"
fi

if [[ "$TARGET" == "staging" ]]; then
  # Cross-Repo-Aliase (@habits, @journal, @fitness/constants) lösen nur relativ
  # zu $SOURCE auf (Sibling-Repos liegen neben fuel-dev). Nach dem Build ist
  # dist/ standalone gebündelt — Stage/Prod brauchen die Sibling-Repos danach
  # nicht mehr.
  if [[ "$BUILD" == true ]]; then
    msg "🔨 Building Node UI in $SOURCE"
    (cd "$SOURCE" && pnpm run build:local > /dev/null)

    msg "🔨 Building frontend/ (React, für den Python-Server)"
    (cd "$SOURCE/frontend" && pnpm run build > /dev/null)
  else
    msg "♻️  Kein frischer Build — bestehende dist/ wird übernommen (--build für neuen Build)"
    [[ -f "$SOURCE/dist/index.html" ]] || die "❌ $SOURCE/dist/index.html fehlt — einmalig mit --build bauen"
    [[ -f "$SOURCE/frontend/dist/index.html" ]] || die "❌ $SOURCE/frontend/dist/index.html fehlt — einmalig mit --build bauen"
  fi

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
  require_file "$STAGE/package.json" "Fuel checkout manifest"
  require_file "$STAGE/dist/index.html" "Node staging dist"
  require_file "$STAGE/frontend/dist/index.html" "Python frontend dist"
  require_file "$STAGE/backend/requirements.txt" "Python backend requirements"

  # node_modules sind vom rsync ausgenommen -> im Stage-Ordner selbst installieren
  msg "📦 Installing Node dependencies in $STAGE"
  (cd "$STAGE" && pnpm install --frozen-lockfile --prod > /dev/null)

  install_stage_unit
  msg "🔄 Restarting user-scope $STAGE_SERVICE"
  user_systemctl enable "$STAGE_SERVICE" > /dev/null 2>&1 || true
  user_systemctl restart "$STAGE_SERVICE"

  msg "🩺 Verifying staging runtime on :$STAGE_PORT"
  if ! user_systemctl is-active --quiet "$STAGE_SERVICE"; then
    user_systemctl status "$STAGE_SERVICE" --no-pager || true
    die "❌ $STAGE_SERVICE is not active after deploy"
  fi
  wait_for_http "http://127.0.0.1:$STAGE_PORT/health" "Staging Node health" > /dev/null

  # Erst NACH dem Neustart des Staging-Servers (der den Sync nicht mehr startet),
  # damit nie zwei Sync-Instanzen gleichzeitig laufen.
  msg "🔄 Restarting user-scope $SYNC_SERVICE"
  user_systemctl enable "$SYNC_SERVICE" > /dev/null 2>&1 || true
  user_systemctl restart "$SYNC_SERVICE"
  sleep 2
  user_systemctl is-active --quiet "$SYNC_SERVICE" || {
    user_systemctl status "$SYNC_SERVICE" --no-pager || true
    die "❌ $SYNC_SERVICE is not active after deploy"
  }

  msg "✅ Deployment to $STAGE complete (staging, $STAGE_SERVICE :$STAGE_PORT)."
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
  --exclude "node_modules" \
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
(cd "$NODE_DEST" && pnpm install --frozen-lockfile)

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
# Das Backend importiert fuel.omega3 (Shared-Paket aus dem Repo-Root); uvicorn
# läuft mit WorkingDirectory=$PYTHON_DEST, also muss fuel/ dort liegen.
msg "📦 Syncing fuel/ (Python-Shared-Paket) $SOURCE/fuel → $PYTHON_DEST/fuel"
rsync -av --delete \
  --exclude "__pycache__" --exclude "*.pyc" \
  "$SOURCE/fuel/" "$PYTHON_DEST/fuel/"
msg "📦 Syncing frontend/ (React) $SOURCE/frontend → $PYTHON_DEST/frontend"
rsync -av --delete \
  --exclude "node_modules" \
  "$SOURCE/frontend/" "$PYTHON_DEST/frontend/"

# Laufzeit-Daten: fuel-python.service verwendet die SQLite-Datei
# /home/alpha/.aos/fuel/nutrition/nutrition.db. Vor dem Service-Neustart wird
# genau diese Datenbank mit demselben DATABASE_URL migriert.

if [[ ! -d "$PYTHON_DEST/backend/.venv" ]]; then
  msg "🐍 Creating venv + installing Python dependencies"
  python3 -m venv "$PYTHON_DEST/backend/.venv"
fi
"$PYTHON_DEST/backend/.venv/bin/pip" install -q -r "$PYTHON_DEST/backend/requirements.txt"

msg "🗃️ Applying Fuel Python database migrations"
(cd "$PYTHON_DEST" && DATABASE_URL="sqlite:////home/alpha/.aos/fuel/nutrition/nutrition.db" \
  "$PYTHON_DEST/backend/.venv/bin/python" -m backend.migrate)

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
msg "✅ Deployment to $NODE_DEST (:7000) + $PYTHON_DEST (:4000) complete."
