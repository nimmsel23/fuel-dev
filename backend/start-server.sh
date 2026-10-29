#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export POETRY_VIRTUALENVS_IN_PROJECT="${POETRY_VIRTUALENVS_IN_PROJECT:-true}"

poetry -P backend run python -m backend.migrate
exec poetry -P backend run uvicorn backend.api.main:app --reload --host 127.0.0.1 --port "${FUEL_BACKEND_PORT:-4000}"
