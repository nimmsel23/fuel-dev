# Fuel im Vital Hub

Vital Hub liefert `frontend/dist/` unter `/fuel/` aus.
Die Hub-Implementierung liegt in
`/home/alpha/.local/vital-hub/vitalctx/{static-server.py,fuel_routes.py}`.
`FUEL_SOURCE` wählt das Fuel-Checkout (Standard `/home/alpha/fuel-dev`).

Build im Verzeichnis `frontend/`:

```sh
FUEL_HUB_BUILD=1 node node_modules/vite/bin/vite.js build
```

API: `/fuel-api/` geht über den Hub an FastAPI auf `127.0.0.1:4000`.
Dieses Frontend nutzt Python/SQLite, nicht den Firestore-Client unter `src/client/`.

Lokale Coach-Werkzeuge ohne Fuel-HTTP-Server (im Fuel-Checkout):

```sh
node scripts/coach-task.mjs status
node scripts/coach-task.mjs pull
node scripts/coach-task.mjs push
node scripts/coach-task.mjs enrich
```

Push/Pull und Enrichment verändern Daten; nicht als Healthcheck verwenden.
Hub-Endpunkt: `POST /fuel-coach`, JSON `{"action":"status"}` (auch
`pull`, `push`, `enrich`), nur Loopback und gleicher Browser-Origin.
Der kurzlebige Worker nutzt bestehende Fuel-Module; keine HTTP-Listener oder Scheduler.
Node bleibt für diese Werkzeuge eine Laufzeitabhängigkeit.

Bestehende Fuel-Dienste wurden nicht abgeschaltet. Port 4000 bleibt erforderlich.
Die Firebase-App besteht separat; vor weiterem Backend-Abbau Funktionen abgleichen.
