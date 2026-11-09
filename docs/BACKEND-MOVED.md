# Backend-Auslagerung

Stand: 2026-11-09.

## Node → `~/dev/backend/fuel`

Fastify/`server.mjs`/Sync: SOT **`~/dev/backend/fuel`**.
Scripts/`fuelctl` zeigen dorthin.

## Python → `~/dev/backend/fuel/backend`

Poetry/Alembic/FastAPI lag nested hier und war nie subtree-gesplittet.
SOT jetzt: **`~/dev/backend/fuel/backend`**.

In diesem Repo ist `backend` ein **Symlink** dorthin (`fuel-devctl` /
`BACKEND_DIR` bleiben gültig).
