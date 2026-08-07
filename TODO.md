Agents dürfen sich nicht auf den lokalen dev server versteifen; prod = firebase!

## v3 → v4 Migration (2026-08-07, laufend)

**Naming:** `src/` (Node/Fastify + altes React-Frontend) = **v3**, aktuell live
(dev :9000, prod :7000 local + `fuel-vos.web.app` Firebase). `frontend/` +
`backend/` (FastAPI + Postgres + neues React-Frontend, `frontend/package.json`
= v4.0.0) = **v4**, aus `~/fuel/` reinkopiert (ohne `node_modules`/`dist`/
`__pycache__`). v4 ist der **eigentliche Nachfolger**, kein Wegwerf-Prototyp —
kein Rückbau von Postgres/SQLAlchemy, kein reiner Proxy-Layer.

**Cross-Reachability (fertig):**
- `src/server/routes/v4-proxy.mjs` — `/v4/*` auf v3 proxied zu `FUEL_V4_URL`
  (default `http://127.0.0.1:4000`).
- `backend/api/endpoints/v3_proxy.py` — `/v3/*` auf v4 proxied zu `FUEL_V3_URL`
  (default `http://127.0.0.1:9000`, später auf Firebase umschaltbar).
- Reine Erreichbarkeits-Routen, kein gemeinsamer Datenlayer.

**Ziel: dev/staging/prod dupliziert sich für v4.** v4 übernimmt schrittweise
Prod-Verantwortung von v3, parallel zur bestehenden v3-Pipeline, bis v3
ausläuft — kein Nebenprojekt. Konkrete Stufen (staging-Port/-Service für v4,
Rollout-Reihenfolge welche Endpoints zuerst wechseln) noch offen.

**Offen:**
- `backend/requirements.txt` neu (fastapi/sqlalchemy/psycopg2/httpx/...) —
  noch nicht in ein venv installiert, v4 läuft lokal noch nicht.
- Kein systemd-Service für v4 (weder dev noch staging noch prod).
- Datenmigration fuel-dev-Store (File+SQLite) → Postgres nicht angegangen.
- Rollout-Reihenfolge (welcher Endpoint zuerst v3→v4 wechselt) nicht entschieden.



~~Habits und Journal können aus dem Firebase Frontend verschwinden~~
**erledigt (2026-08-07):** `routes.js` markiert `journal`/`habits` mit
`cloudHidden: true`, `main.jsx` filtert Nav-Buttons + Hash-Routing im
Cloud-Build (`isCloud || isClientBuild`) raus. Journal-Widget im Dashboard
(Ernährungs-Tagebuch, `Dashboard/JournalWidget.jsx`) bleibt unverändert
sichtbar. Lazy-Chunks (HabitVosView/JournalVosView) bleiben im Bundle,
werden aber im Cloud-Frontend nie geladen.





~~main.jsx hat über 1000 Zeilen schon. müsste modularisiert werden.~~
(Bereits erledigt: main.jsx hat nur noch 170 Zeilen, Tabs sind via routes.js in Lazy-Komponenten modularisiert!)

## Cleanup: db-Layer (2026-07-18, von vitalos-Session gefunden)

- ~~`src/client/lib/db/index.js` ist toter Code~~ — **FALSCH, NICHT löschen.**
  Wird über die Vite-Aliase `@db`/`@utils` (`vite.config.cjs`) von
  `habits-dev`/`journal-dev` importiert, die via `@habits`/`@journal` in den
  fuel-dev-Build eingebunden werden (`HabitVosView.jsx`, `JournalVosView.jsx`).
  Grep über `fuel-dev/src` allein reicht nicht — Cross-Repo-Check nötig.
  (2026-07-18: versehentlich gelöscht, Build brach, wiederhergestellt.)
- ~~Diverse `.bak`-Leichen im db-Umfeld~~ **erledigt (2026-07-18):**
  `lib/firestore-db.js.bak`, `client/routes.js.bak`, `client/lib/api.js.bak2`,
  `views/SettingsView.jsx.bak`, `lib/db/firestore/{supplements,nutrition,core}.js.bak`
  gelöscht (verifiziert unbenutzt, Build läuft). `store.js.bak` und
  `DailyChecklist.jsx.bak` existierten nicht mehr. `firestore-db.js` (ohne
  .bak) bleibt — aktiver Barrel auf `db.firestore.js`.
  Details: siehe `RESULTS.md` (2026-07-18), weitere Funde: `NEXT.md`.

## Duplikate: db/firestore/utils.js vs. shared/utils/* (2026-07-18)

- **`todayISO()`** — **erledigt (2026-07-18).** `shared/utils/
  validation.mjs::todayISO()` nutzte `toISOString()` → UTC, während
  `client/lib/db/firestore/utils.js::todayISO()` lokale Zeitzone nutzte.
  Bug: Server (Europe/Vienna, CEST/UTC+2) berechnete "heute" per UTC —
  zwischen 00:00–02:00 lokaler Zeit fiel ein Log auf den Vortag statt auf
  den vom Client angezeigten aktuellen Tag. Fix: `shared/utils/
  validation.mjs::todayISO()` auf lokale Zeitzone umgestellt (gleiche
  Formel wie Client). `client/lib/db/firestore/utils.js` importiert
  `todayISO` jetzt von dort statt es zu duplizieren (`localToday` bleibt
  als lokaler Alias). Verifiziert: Build + beide Module liefern identisches
  Datum.
- **`randomId()`** — **nicht angefasst.** `client/lib/db/firestore/
  utils.js::randomId` ist ungenutzter toter Code (kein Importer, auch
  nicht via `db/index.js`-Barrel-Wildcard-Export real konsumiert — noch
  nicht verifiziert, ob wirklich niemand ihn zieht). Server nutzt aktiv
  `shared/utils/ids.mjs::randomId` mit eigenem Präfix-Format. Getrennt
  klären statt hier mitzuziehen — kein Zeitzonen-Bug, nur Verwirrung.
- `MICRO_KEYS`, `zeroMicros`, `getWeekDates` bleiben in `db/firestore/
  utils.js` — reine DB-Domain-Utilities (Firestore-Feldnamen), gehören
  nicht nach `shared/`.
