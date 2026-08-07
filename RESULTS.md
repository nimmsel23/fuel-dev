# RESULTS.md

Session-Log mit datierten Ergebnis-Bullets.

## 2026-08-07 (v4-Merge)

- `~/fuel/` (Python/FastAPI + Postgres, v4.0.0-Frontend) komplett nach hierher
  gemerged: `frontend/` + `backend/` (Code), plus Rest (`alembic/`, `main.py`,
  `pyproject.toml`, `docker-compose.yml`, Docs, `scripts/`) unter `backend/`.
  `.env` mit echtem `GEMINI_API_KEY` bewusst nicht kopiert (Credential-Leakage-Risiko).
- v3↔v4 Cross-Reachability-Proxies gebaut: `src/server/routes/v4-proxy.mjs`
  (`/v4/*`), `backend/api/endpoints/v3_proxy.py` (`/v3/*`) — reine Erreichbarkeit,
  kein gemeinsamer Datenlayer.
- `backend/core/config.py`: SQLite-Fallback-Pfad von relativ (`./backend.db`,
  wanderte je nach Start-cwd) auf an `backend/` geankert gefixt.
- v4 lokal end-to-end getestet: `uvicorn` auf :4000, `/health` ok, `/v3/health`
  erreicht laufenden Node-Server über Proxy, `/` liefert gebautes v4-Frontend.
- Historische v4-Ergebnisse aus `~/fuel/RESULTS.md` (2026-07-09/10): initiale
  Projektstruktur, Refactoring aller 9 Frontend-Views auf FastAPI-Backend,
  Umbau auf "Journal-First" `DailyJournal`-Modell, Mikronährstoff-Aggregation
  optimiert (`micros_sum` pre-calculated), `water_ml`-Spaltentyp gefixt.

## 2026-07-18

- **db-Layer-Cleanup (TODO.md):**
  - `src/client/lib/db/index.js` zunächst fälschlich als toten Code eingestuft und gelöscht — Grep hatte nur `fuel-dev/src` durchsucht. Tatsächlich wird die Datei über die Vite-Aliase `@db`/`@utils` (in `vite.config.cjs`) von `habits-dev` und `journal-dev` importiert, die wiederum via `@habits`/`@journal` in den fuel-dev-Build eingebunden werden (`HabitVosView.jsx`, `JournalVosView.jsx`). Build brach dadurch. Fehler erkannt, Datei + Aliase wiederhergestellt, Build erneut verifiziert (`npm run build:local` läuft sauber durch).
  - **Tatsächlich tote `.bak`-Dateien im db-Umfeld gelöscht** (verifiziert: kein Importer, keine Cross-Repo-Referenz, Build läuft ohne sie):
    - `src/client/lib/firestore-db.js.bak`
    - `src/client/routes.js.bak`
    - `src/client/lib/api.js.bak2`
    - `src/client/views/SettingsView.jsx.bak`
    - `src/client/lib/db/firestore/supplements.js.bak`
    - `src/client/lib/db/firestore/nutrition.js.bak`
    - `src/client/lib/db/firestore/core.js.bak`
    - (`store.js.bak` und `DailyChecklist.jsx.bak` existierten bereits nicht mehr)
  - `firestore-db.js` (ohne `.bak`) bleibt erhalten — ist aktiver Barrel auf `db.firestore.js`, wird aber selbst von nichts importiert (kein Cleanup-Kandidat laut TODO, nur geprüft).

- **Zeitzonen-Bug `todayISO()` gefixt (TODO.md):**
  - `src/shared/utils/validation.mjs::todayISO()` nutzte `new Date().toISOString().split("T")[0]` → UTC-Datum. Server läuft in Europe/Vienna (CEST, UTC+2) — zwischen 00:00 und 02:00 Uhr lokaler Zeit lieferte `todayISO()` noch das Datum von gestern. Betroffen: alle Server-Routes, die `todayISO()` als Default für fehlendes `date`-Query-Param nutzen (`nutrition/log`, `nutrition/notes`, `supplements`, `ai-log`).
  - Fix: Formel auf lokale Zeitzone umgestellt (`getFullYear/getMonth/getDate`, identisch zur bereits korrekten Client-Version in `client/lib/db/firestore/utils.js`).
  - Dedupe: `client/lib/db/firestore/utils.js` importiert `todayISO` jetzt aus `shared/utils/validation.mjs` statt es erneut zu implementieren. `localToday()` bleibt als lokaler Alias bestehen.
  - Verifiziert: `npm run build:local` erfolgreich, beide Module (`node --input-type=module`-Testaufruf) liefern identisches lokales Datum.
  - `randomId()`-Duplikat (unterschiedliches Format in Client vs. Server) bewusst nicht angefasst — kein Bug, nur Doppelimplementierung; separat zu klären (siehe NEXT.md).
