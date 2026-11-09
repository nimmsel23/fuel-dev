# Backend-Auslagerung

Stand: 2026-11-09.

## Node → `~/dev/backend/fuel`

Fastify/`server.mjs`/Sync: SOT **`~/dev/backend/fuel`**.
Scripts/`fuelctl` zeigen auf `../backend/fuel`.

## Shared → `~/dev/backend/fuel/src/shared`

Echte Dateien (kein Ordner-Symlink). In diesem Repo liegen unter
`src/shared/` nur **Re-Export-Stubs** auf die SOT — relative Imports
(`../../shared/...`) bleiben stabil; Staging bekommt die echten Dateien
via `deploy.sh`/`sync_backend`.

## Python → `~/dev/backend/fuel/backend`

Kein Symlink. `fuel-devctl` → `FUEL_PYTHON_BACKEND_DIR` /
Default `../backend/fuel/backend`.
