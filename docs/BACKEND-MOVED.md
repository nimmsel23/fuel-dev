# Backend-Auslagerung

Stand: 2026-11-09.

## Node → `~/dev/backend/fuel`

Fastify/`server.mjs`/Sync: SOT **`~/dev/backend/fuel`**.
Scripts/`fuelctl` zeigen auf `../backend/fuel`.

## Python → `~/dev/backend/fuel/backend`

Kein Symlink mehr in diesem Repo. `fuel-devctl` setzt
`BACKEND_DIR` auf `../backend/fuel/backend` (override:
`FUEL_PYTHON_BACKEND_DIR`).
