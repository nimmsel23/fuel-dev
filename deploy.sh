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
SERVICE="fuel.service"
UNIT_TARGET="/etc/systemd/system/fuel.service"
INSTALL_UNIT=false
INSTALL_ONLY=false
BUILD=false
DRY_RUN=false
# Staging-Service (user-scope, analog fitness-preview.service :8100)
STAGE_SERVICE="fuel-preview.service"
STAGE_PORT=8700
STAGE_UNIT_TARGET="$USER_HOME/.config/systemd/user/$STAGE_SERVICE"
# Firestore-Sync als eigener Dienst (scripts/sync-daemon.mjs, ohne Fastify)
SYNC_SERVICE="fuel-sync.service"
SYNC_UNIT_TARGET="$USER_HOME/.config/systemd/user/$SYNC_SERVICE"

die() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
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
      die "Invalid argument '$arg'. Supported: --install | --install-only | --build | --dry-run"
      ;;
  esac
done

msg() { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*" >&2; }


# Product payload; excludes are NOT a growing list of development leftovers.
RSYNC_RUNTIME=(
  --exclude '*.bak*' --exclude '*.map' --exclude '.claude' --exclude '.codex'
  --filter 'P /node_modules/***' --filter 'P /.venv/***'
  --filter 'P /.env*' --filter 'P /data/***' --filter 'P /.git/***'
  --filter 'P /catalogs/***'
  --exclude 'node_modules' --exclude '.venv' --exclude '__pycache__'
  --exclude '*.pyc' --exclude 'tests' --exclude '.git'
  --include '/dist/***' --include '/public/***'
  --include '/server.mjs'
  --include '/src/' --include '/src/server/***' --include '/src/shared/***'
  --include '/src/client/' --include '/src/client/lib/'
  --include '/src/client/lib/mealDetails.js' --include '/src/client/lib/mealComponents.js'
  --include '/fuel/constants/***'
  --include '/fuel/' --include '/fuel/**/' --include '/fuel/**.py'
  --include '/bin/' --include '/bin/gemini-estimate' --include '/bin/gemini-compose' --include '/bin/gemini-micros'
  --include '/scripts/' --include '/scripts/sync-daemon.mjs'
  --include '/deploy/' --include '/deploy/runtime/***'
  --include '/pyproject.toml' --include '/README.md'
  --exclude '*'
)

sync_runtime() {
  local dest="$1"
  shift
  "$@" rsync -aL --delete --delete-excluded "${RSYNC_RUNTIME[@]}" "$SOURCE/" "$dest/"
  # Separate locked server dependencies: React, Vite and frontend SDKs are
  # already bundled in dist and never get installed into the runtime.
  cp "$SOURCE/deploy/runtime/"{package.json,pnpm-lock.yaml,pnpm-workspace.yaml} "$dest/"
}

link_catalogs() {
  local dest="$1" central="$USER_HOME/.aos/fuel/catalogs" seed
  mkdir -p "$central"
  # Preserve deployed writes before considering the source seed.
  for seed in "$dest/catalogs" "$SOURCE/catalogs" "$DEV_SOURCE/catalogs"; do
    if [[ -d "$seed" && "$(realpath "$seed")" != "$(realpath "$central")" ]]; then
      rsync -aL --ignore-existing --exclude '.git' "$seed/" "$central/"
    fi
  done
  if [[ -L "$dest/catalogs" ]]; then
    rm "$dest/catalogs"
  elif [[ -e "$dest/catalogs" ]]; then
    # Keep conflicting originals for inspection outside the installed product.
    local archive="$USER_HOME/.aos/fuel/catalog-migrations/$(date +%Y%m%dT%H%M%S)-$(basename "$dest")"
    mkdir -p "$(dirname "$archive")"
    mv "$dest/catalogs" "$archive"
    msg "Preserved original catalog directory at $archive"
  fi
  ln -s "$central" "$dest/catalogs"
}

install_runtime() {
  local dest="$1"
  (cd "$dest" && pnpm install --frozen-lockfile --prod)
  (cd "$dest" && {
    if command -v uv >/dev/null; then
      [[ -x .venv/bin/python ]] || uv venv --quiet
      uv pip install . --quiet
    else
      [[ -x .venv/bin/python ]] || python3 -m venv .venv
      .venv/bin/python -m pip install . --quiet
    fi
  })
}

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
Environment=FUEL_STATIC_DIR=/opt/fuel/dist
Environment=PATH=/opt/fuel/.venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node server.mjs
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
Environment=PATH=$STAGE/.venv/bin:/usr/local/bin:/usr/bin:/bin
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
  sudo systemctl daemon-reload
  msg "✅ Installed Fuel Node prod unit and reloaded systemd."
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

if $DRY_RUN; then
  require_file "$SOURCE/dist/index.html" "built local frontend"
  require_file "$SOURCE/deploy/runtime/package.json" "locked runtime manifest (deploy staging first)"
  dest="$STAGE"
  [[ "$TARGET" != prod ]] || dest="$NODE_DEST"
  rsync -ani --delete --delete-excluded "${RSYNC_RUNTIME[@]}" "$SOURCE/" "$dest/"
  exit 0
fi

if [[ "$TARGET" == "staging" ]]; then
  # Cross-Repo-Aliase (@habits, @journal, @fitness/constants) lösen nur relativ
  # zu $SOURCE auf (Sibling-Repos liegen neben fuel-dev). Nach dem Build ist
  # dist/ standalone gebündelt — Stage/Prod brauchen die Sibling-Repos danach
  # nicht mehr.
  if [[ "$BUILD" == true ]]; then
    msg "🔨 Building Node UI in $SOURCE"
    (cd "$SOURCE" && pnpm run build:local > /dev/null)

  else
    msg "♻️  Kein frischer Build — bestehende dist/ wird übernommen (--build für neuen Build)"
    [[ -f "$SOURCE/dist/index.html" ]] || die "❌ $SOURCE/dist/index.html fehlt — einmalig mit --build bauen"
  fi

  msg "📦 Staging: $SOURCE → $STAGE"
  mkdir -p "$STAGE"
  sync_runtime "$STAGE"
  link_catalogs "$STAGE"
  require_file "$STAGE/dist/index.html" "installed frontend"
  install_runtime "$STAGE"

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

require_file "$SOURCE/dist/index.html" "staged frontend"
require_file "$SOURCE/deploy/runtime/package.json" "locked runtime manifest (deploy staging first)"
msg "📦 Syncing runtime $SOURCE → $NODE_DEST"
sync_runtime "$NODE_DEST" sudo
sudo chown -R "$(id -u):$(id -g)" "$NODE_DEST"
link_catalogs "$NODE_DEST"
install_runtime "$NODE_DEST"
install_prod_unit

if systemctl list-unit-files "$SERVICE" >/dev/null 2>&1; then
  msg "🔄 Restarting $SERVICE"
  sudo systemctl restart "$SERVICE"
else
  warn "⚠️ $SERVICE not found. Skipping restart."
fi

msg "✅ Node deployed to $NODE_DEST."

# The Fuel FastAPI routers are composed by ~/workspace/VitalOS on :8000.
# Keep an old standalone unit from being resurrected by a legacy local deploy.
if sudo systemctl cat fuel-python.service >/dev/null 2>&1; then
  msg "🛑 Disabling retired fuel-python.service (:4000)"
  sudo systemctl disable --now fuel-python.service
fi

msg "🩺 Verifying production runtime"
if systemctl list-unit-files "$SERVICE" >/dev/null 2>&1; then
  if ! sudo systemctl is-active --quiet "$SERVICE"; then
    print_systemd_failure_context "$SERVICE"
    die "❌ $SERVICE is not active after deploy"
  fi
fi

if ! wait_for_http "http://127.0.0.1:7000/health" "Prod Node health" >/dev/null; then
  print_systemd_failure_context "$SERVICE"
  die "❌ Prod Node healthcheck failed"
fi

msg "ℹ️ Fuel FastAPI is provided by VitalOS on :8000 (/api/fuel/*)."
msg "✅ Fuel Node deployed to $NODE_DEST (:7000); no standalone Python service is installed."
