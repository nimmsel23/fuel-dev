# Backend: was ausgelagert ist — und was nicht

Stand: 2026-11-09.

## Node → `~/dev/backend/fuel` (ausgelagert)

Fastify/`server.mjs`/Sync: war `~/dev/fuel-backend` (subtree aus diesem Repo),
jetzt **`~/dev/backend/fuel`**. Scripts zeigen dorthin.  
`node-backend/`-Rest im Parent darf weg (nur Leftover nach dem Split).

## Python `backend/` → **noch hier** (nicht sauber extrahiert)

`fuel-dev/backend/` (Poetry, Alembic, FastAPI nutrition, …) wurde **nicht** in
`backend/fuel` (Node) und nirgends sonst als Subtree-SOT abgelegt.

Solange kein Split existiert: **dieses `backend/` behalten** — das ist die
Python-Arbeitsquelle, keine „tote Doppelung“ vom Node-Server.

Archiv-Spiegel:  
`~/dev/_archive/2026-11-09-nested-backend-copies/fuel-dev-backend-python`
