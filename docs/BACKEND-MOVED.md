# Backend-Auslagerung

Stand: 2026-11-09.

## Node → `~/dev/backend/fuel`

Fastify/`server.mjs`/Sync: SOT **`~/dev/backend/fuel`**.
Scripts/`fuelctl` zeigen auf `../backend/fuel`.

## Shared → `~/dev/backend/fuel/src/shared`

Echte Dateien (kein Symlink). Frontend importiert via `#shared`
(Vite-Alias + `package.json#imports` → dünne Re-Export-Stubs in
`fuel-dev/src/shared`). `deploy.sh` synct Shared aus dem Backend.

## Python → `~/dev/backend/fuel/backend`

Kein Symlink. `fuel-devctl` → `FUEL_PYTHON_BACKEND_DIR` /
Default `../backend/fuel/backend`.
