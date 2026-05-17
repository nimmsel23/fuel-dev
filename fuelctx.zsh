#!/usr/bin/env zsh
# FuelCtx development TUI
# Manages the local fuel-dev stack (Node API + Vite dev UI)

WORKDIR="/home/alpha/fuel-dev"
PORT="${PORT:-9000}"
VITE_PORT="${VITE_PORT:-5173}"
LOGFILE="${LOGFILE:-/tmp/fuelctx-dev.log}"
PIDFILE="${PIDFILE:-/tmp/fuelctx-dev.pid}"

typeset -A COLORS
COLORS=(
  reset   $'\033[0m'
  bold    $'\033[1m'
  dim     $'\033[2m'
  red     $'\033[31m'
  green   $'\033[32m'
  yellow  $'\033[33m'
  blue    $'\033[34m'
  magenta $'\033[35m'
  cyan    $'\033[36m'
)

print_color() {
  local color=$1
  shift
  echo -e "${COLORS[$color]}$@${COLORS[reset]}"
}

pause_any_key() {
  read -k 1 -s -r "?Press any key..."
}

check_dependencies() {
  local missing=()

  [[ ! -d "$WORKDIR" ]] && missing+=("Directory: $WORKDIR")
  ! command -v npm >/dev/null 2>&1 && missing+=("npm")
  ! command -v node >/dev/null 2>&1 && missing+=("node")
  ! command -v curl >/dev/null 2>&1 && missing+=("curl")

  if (( ${#missing[@]} > 0 )); then
    print_color red "✗ Missing dependencies:"
    printf "  - %s\n" "${missing[@]}"
    return 1
  fi

  return 0
}

get_server_pid() {
  local pid=""

  if [[ -f "$PIDFILE" ]]; then
    pid=$(<"$PIDFILE")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi

  pgrep -f "node.*scripts/dev-runner.mjs|nodemon.*scripts/dev-runner.mjs|npm run dev" | head -1
}

is_server_running() {
  curl -sf --max-time 1 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1
}

get_server_status() {
  if is_server_running; then
    local pid uptime
    pid=$(get_server_pid)
    uptime=$(ps -p "$pid" -o etime= 2>/dev/null | xargs)
    echo "${COLORS[green]}●${COLORS[reset]} Running ${COLORS[dim]}(PID: ${pid:-unknown}, Up: ${uptime:-unknown})${COLORS[reset]}"
  else
    echo "${COLORS[red]}○${COLORS[reset]} Stopped"
  fi
}

check_health() {
  local response
  if response=$(curl -fsS --max-time 2 "http://127.0.0.1:$PORT/health" 2>&1); then
    print_color green "✓ Health check passed"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    return 0
  fi

  print_color red "✗ Health check failed"
  return 1
}

start_server() {
  if is_server_running; then
    print_color yellow "⚠ Server already running (PID: $(get_server_pid))"
    pause_any_key
    return 1
  fi

  if [[ ! -d "$WORKDIR" ]]; then
    print_color red "✗ Directory not found: $WORKDIR"
    pause_any_key
    return 1
  fi

  print_color blue "Starting fuelctx dev stack..."

  cd "$WORKDIR" || {
    print_color red "✗ Cannot cd to $WORKDIR"
    pause_any_key
    return 1
  }

  : > "$LOGFILE"

  print_color dim "→ Working dir: $WORKDIR"
  print_color dim "→ API port:    $PORT"
  print_color dim "→ Vite port:   $VITE_PORT"
  print_color dim "→ Log file:    $LOGFILE"

  PORT="$PORT" FUEL_VITE_ORIGIN="http://127.0.0.1:$VITE_PORT" npm run dev >"$LOGFILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PIDFILE"

  sleep 2

  if is_server_running; then
    print_color green "✓ FuelCtx started (PID: $(get_server_pid))"
    check_health
  else
    print_color red "✗ FuelCtx failed to start"
    print_color yellow "Last 20 log lines:"
    tail -20 "$LOGFILE"
  fi

  pause_any_key
}

stop_server() {
  local pid
  pid=$(get_server_pid)

  if [[ -z "$pid" ]]; then
    print_color yellow "⚠ Server not running"
    [[ -f "$PIDFILE" ]] && rm -f "$PIDFILE"
    pause_any_key
    return 0
  fi

  print_color blue "Stopping fuelctx (PID: $pid)..."
  kill "$pid" 2>/dev/null
  sleep 1

  if kill -0 "$pid" 2>/dev/null; then
    print_color yellow "→ Forcing shutdown..."
    kill -9 "$pid" 2>/dev/null
  fi

  pkill -f "node.*scripts/dev-runner.mjs|node.*server.mjs|node_modules/.bin/vite|vite" >/dev/null 2>&1 || true
  [[ -f "$PIDFILE" ]] && rm -f "$PIDFILE"

  if ! is_server_running; then
    print_color green "✓ FuelCtx stopped"
  else
    print_color red "✗ FuelCtx still responding on port $PORT"
  fi

  pause_any_key
}

restart_server() {
  print_color blue "Restarting fuelctx..."
  stop_server
  sleep 1
  start_server
}

tail_logs() {
  if [[ ! -f "$LOGFILE" ]]; then
    print_color yellow "⚠ Log file not found: $LOGFILE"
    pause_any_key
    return
  fi

  clear
  print_color cyan "═══ Live Logs (Ctrl+C to exit) ═══"
  echo ""
  tail -f "$LOGFILE"
}

view_logs() {
  if [[ ! -f "$LOGFILE" ]]; then
    print_color yellow "⚠ Log file not found: $LOGFILE"
    pause_any_key
    return
  fi

  clear
  print_color cyan "═══ Last 60 lines ═══"
  echo ""
  tail -60 "$LOGFILE"
  echo ""
  pause_any_key
}

clear_logs() {
  print_color yellow "Clear log file? (y/N) "
  read -k 1 -r confirm
  echo ""

  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    : > "$LOGFILE"
    print_color green "✓ Logs cleared"
  else
    print_color dim "Cancelled"
  fi

  sleep 0.5
}

show_info() {
  clear
  print_color cyan "═══════════════════════════════════════════════════════════"
  print_color cyan "  FuelCtx Development Server - System Info"
  print_color cyan "═══════════════════════════════════════════════════════════"
  echo ""

  print_color bold "Configuration:"
  echo "  Working Dir: $WORKDIR"
  echo "  API Port:    $PORT"
  echo "  Vite Port:   $VITE_PORT"
  echo "  Log File:    $LOGFILE"
  echo "  PID File:    $PIDFILE"
  echo ""

  print_color bold "Status:"
  echo -n "  Server:      "
  get_server_status
  echo ""

  print_color bold "Dependencies:"
  echo "  node: $(node --version 2>/dev/null || echo 'not found')"
  echo "  npm:  $(npm --version 2>/dev/null || echo 'not found')"
  echo "  curl: $(curl --version 2>/dev/null | head -1 || echo 'not found')"
  echo ""

  if [[ -f "$WORKDIR/package.json" ]]; then
    print_color bold "Package Info:"
    echo "  Name:    $(jq -r '.name // \"unknown\"' "$WORKDIR/package.json" 2>/dev/null)"
    echo "  Version: $(jq -r '.version // \"unknown\"' "$WORKDIR/package.json" 2>/dev/null)"
    echo ""
  fi

  print_color bold "Endpoints:"
  echo "  Health: http://127.0.0.1:$PORT/health"
  echo "  v1:     http://127.0.0.1:$PORT/"
  echo "  v2:     http://127.0.0.1:$PORT/v2"
  echo "  Vite:   http://127.0.0.1:$VITE_PORT/"
  echo ""

  pause_any_key
}

show_menu() {
  clear

  cat <<EOF
${COLORS[cyan]}┌─────────────────────────────────────────────────────────────────┐${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[bold]}FUELCTX DEV${COLORS[reset]} - API $PORT / Vite $VITE_PORT                     ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}├─────────────────────────────────────────────────────────────────┤${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[green]}1${COLORS[reset]}) Start server           ${COLORS[cyan]}│${COLORS[reset]} ${COLORS[yellow]}6${COLORS[reset]}) View logs (last 60)      ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[green]}2${COLORS[reset]}) Stop server            ${COLORS[cyan]}│${COLORS[reset]} ${COLORS[yellow]}7${COLORS[reset]}) Tail logs (live)         ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[green]}3${COLORS[reset]}) Restart server         ${COLORS[cyan]}│${COLORS[reset]} ${COLORS[yellow]}8${COLORS[reset]}) Clear logs               ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[blue]}4${COLORS[reset]}) Health check           ${COLORS[cyan]}│${COLORS[reset]} ${COLORS[magenta]}9${COLORS[reset]}) System info              ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}│${COLORS[reset]} ${COLORS[blue]}5${COLORS[reset]}) Open URLs note         ${COLORS[cyan]}│${COLORS[reset]} ${COLORS[red]}0${COLORS[reset]}) Exit                     ${COLORS[cyan]}│${COLORS[reset]}
${COLORS[cyan]}└─────────────────────────────────────────────────────────────────┘${COLORS[reset]}
EOF
}

open_browser() {
  clear
  print_color cyan "FuelCtx URLs"
  echo ""
  echo "  v1:   http://127.0.0.1:$PORT/"
  echo "  v2:   http://127.0.0.1:$PORT/v2"
  echo "  Vite: http://127.0.0.1:$VITE_PORT/"
  echo ""
  pause_any_key
}

main() {
  if ! check_dependencies; then
    print_color red "\nCannot proceed without dependencies."
    exit 1
  fi

  trap 'echo ""; print_color yellow "Exiting..."; exit 0' INT TERM

  while true; do
    show_menu
    echo -n "${COLORS[bold]}Select:${COLORS[reset]} "
    read -k 1 -r choice
    echo ""

    case "$choice" in
      1) start_server ;;
      2) stop_server ;;
      3) restart_server ;;
      4) check_health; pause_any_key ;;
      5) open_browser ;;
      6) view_logs ;;
      7) tail_logs ;;
      8) clear_logs ;;
      9) show_info ;;
      0)
        print_color yellow "Exiting..."
        exit 0
        ;;
      *)
        print_color red "Invalid option: $choice"
        sleep 0.5
        ;;
    esac
  done
}

main "$@"
