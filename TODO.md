Agents dürfen sich nicht auf den lokalen dev server versteifen; prod = firebase!

## Immediate — Python Backend Standard (2026-10-29)

- [x] Fuel Python/FastAPI-Backend auf den projektspezifischen Poetry-Standard umgestellt: Dev-Start, Anleitung und Standalone-Deploy nutzen `pyproject.toml` + `poetry.lock`. Siehe `RESULTS.md` (Python Backend Poetry Standard, 2026-10-29).
- [x] Fuel-Router aggregiert und in `~/workspace/VitalOS` unter `/api/fuel/*` im zentralen `:8000`-Backend eingebunden. Das Coach-Gateway zeigt auf diese API; Fuel-Source und SQLite-Daten bleiben Fuel-owned. `fuel-python.service` auf :4000 ist seit 2026-10-29 gestoppt und deaktiviert; Firebase bleibt der Produkt-Einstieg. Siehe `RESULTS.md` (VitalOS unified API, 2026-10-29).

## v3 → v4 Migration (2026-08-07, laufend)

**Naming:** `src/` (Node/Fastify + altes React-Frontend) = **v3**, aktuell live
(dev `:9000`, Desktop-Prod via `fuel.service` auf `:7000`, plus `fuel-vos.web.app`
für Firebase). `frontend/` + `backend/` (FastAPI + Postgres + neues React-Frontend,
`frontend/package.json` = v4.0.0) = **v4**, aus `~/fuel/` reinkopiert (ohne
`node_modules`/`dist`/`__pycache__`). v4 ist der **eigentliche Nachfolger**, kein
Wegwerf-Prototyp — kein Rückbau von Postgres/SQLAlchemy, kein reiner Proxy-Layer.

**Cross-Reachability (fertig):**
- `src/server/routes/v4-proxy.mjs` — `/v4/*` auf v3 proxied zu `FUEL_V4_URL`
  (default `http://127.0.0.1:4000`).
- `backend/api/endpoints/v3_proxy.py` — `/v3/*` auf v4 proxied zu `FUEL_V3_URL`
  (default `http://127.0.0.1:9000`, später auf Firebase umschaltbar).
- Ergebnis: v3 und v4 können sich im Übergang gegenseitig erreichen; v4 kann also
  bereits Frontend + eigene API tragen und im Zweifelsfall Legacy an v3 zurückreichen.
- Reine Erreichbarkeits-Routen, kein gemeinsamer Datenlayer.

**Aktueller Stand (2026-10-29):** Die Fuel-FastAPI-Router sind in-process in
`~/workspace/VitalOS` unter `/api/fuel/*` eingebunden. Coach nutzt diese API auf
`:8000`; SQLite und Fuel-Quellcode bleiben Fuel-owned. `fuel-python.service`
(:4000) ist gestoppt und deaktiviert. Firebase bleibt der Produkt-Einstieg.
Der ältere Ablauf darunter beschreibt den vorherigen v3/v4-Übergang.

**Offen:**
- v4 hat einen eigenen Backend-Service, aber noch keinen eigenen öffentlichen
  Produkt-Einstieg. Vor einem Wechsel Frontend und API im Zielpfad Ende zu Ende prüfen.
- Datenmigration des v3-Stores (File+SQLite) → Postgres fehlt. Vor Migration
  Datenbesitzer, Tabellen/Felder und Rückweg inventarisieren; bestehende
  Laufzeitdaten erst nach gesonderter Freigabe verändern.
- Rollout-Reihenfolge (welcher Endpoint zuerst v3→v4 wechselt) nicht entschieden.
- `backend/docker-compose.yml` definiert Postgres, aber `deploy.sh` setzt für
  `fuel-python.service` ausdrücklich die bestehende SQLite-Datei als
  `DATABASE_URL`. Ob ein Postgres-Container läuft, ist hier nicht verifiziert.
- `/opt/fuel-python` ist als v4-Deploy-Ziel im `deploy.sh` implementiert.

**Erledigt (aus `~/fuel/TODO.md`, v4-Historie vor dem Merge):**
- [x] Poetry-Projekt-Init, Kern-Deps (sqlalchemy/pydantic/google-genai/python-dotenv)
- [x] SQLAlchemy-DB-Architektur mit Katalog-Tabelle
- [x] Gemini-API-Integration für NLP-Makro-Extraktion
- [x] Alle 9 Frontend-Views + Hooks auf FastAPI-Backend refactored (Legacy-Firestore-Code raus)
- [x] Backend-Umbau auf `DailyJournal`-Architektur
- [x] Frontend-Auslieferung direkt im FastAPI-Backend (SPA-Routing)
- v4-Doku (`README.md`, `ARCHITECTURE.md`, `RESULTS.md`, `DEPENDENCY.md`, `ANLEITUNG.md`) liegt jetzt unter `backend/`.



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
- **`randomId()`** — **erledigt (2026-09-23).** Ungenutzte Firestore-Kopie
  entfernt; `rg` fand keinen Verbraucher in `src/`, `frontend/` oder `backend/`.
  Der Server behält `shared/utils/ids.mjs::randomId`.
- `MICRO_KEYS`, `zeroMicros`, `getWeekDates` bleiben in `db/firestore/
  utils.js` — reine DB-Domain-Utilities (Firestore-Feldnamen), gehören
  nicht nach `shared/`.

## Supplements-Mini-App (2026-10-16)

- [x] Supplements eigenständig bedienbar machen: Tagesübersicht, Bereiche, Wochenplan und Katalogsuche.
- [x] Eigener Einstieg und Datenabruf ohne Fuel-Dashboard; Reminder-Einstellungen in der Mini-App.
- [x] Tageszählung, zyklische Planung und Mutation-Feedback korrigieren; Solo-Build prüfen und separat deployen.

## Supplements: sofortiges Feedback und Habit-Woche (2026-10-16)

- [x] Einnahmen und Entfernen optimistisch anzeigen, lokal dauerhaft sichern und Cloud im Hintergrund synchronisieren.
- [x] Wochenzeile pro Supplement mit Tagen, Navigation, Suche und nachträglicher Erfassung.
- [x] Langsame Schreibvorgänge, Rücknahme, Fehlerfälle und schmale Ansichten prüfen; Solo-Update veröffentlichen.

- [x] Offline-Cache über App-Updates erhalten: gemeinsame SW-Strategie, API-Migration, vollständiges Asset-Precache und sichere Installation.

- [x] Omega-3-Erkennung vertiefen: ALA/EPA/DHA/DPA, EPA+DHA separat, Einheiten, Etikettbezug und unbekannte Werte korrekt behandeln; USDA-EPA korrigieren.
- [ ] Omega-3 weiter vertiefen: Fettsäurebelege pro Quelle/Etikett, Plausibilitätsprüfung gegen Gesamtfett und gezielte Korrektur belegter Fehlprofile (siehe OMEGA3.md).

## Fotoscanner für Jakob (2026-10-30)

- [x] Globalen TODO-Stand mit Code/Roadmap abgleichen und erledigte Barcode-/Micros-Punkte korrigieren.
- [x] Katalogauswahl vor KI-Aufruf, Zutatenvertrag mit Text-Logger teilen, Zutaten beim Portionswechsel mitskalieren.
- [x] Eigene Bildqualität für Essen und Etiketten/Belege; Scanner und Shutter teilen den Dialog.
- [x] Nutzer-/datumsgebundene Offline-Foto-Warteliste mit IndexedDB, sichtbarem Status und bewusstem Fortsetzen.
- [x] App-Check-Site-Key in Check-/Preview-/Live-Build-Umgebung durchreichen.
- [ ] Firebase App Check live prüfen: Web-App-Registrierung, Zuordnung des vorhandenen Site-Keys für Hosting-Domains, Enforcement und gültige Tokens. CI-Variable ist gesetzt und im Live-Fuel-Bundle nachgewiesen; Projektzugriff per gcloud hier nicht nutzbar.
- [x] Push und Standalone-Firebase-Release nach Freigabe: PR #6, `master` 746e3ac, CI 41050794246 grün; Fuel-Pointer 17db6ae gepusht; Shell-Fix 2e69ba3 und Shell-CI 41051683942 grün.
- [ ] Auf Jakobs Gerät abnehmen. Bundle/CI sind geprüft; echte Kamera und Firebase-/App-Check-Scan stehen aus.

## 2026-10-31 — Lokales Produkt unter /opt

- [x] Lokales Produkt mit expliziter Runtime-Allowlist, eigenem Server-Paket/Lockfile (12 direkte Node-Abhängigkeiten), Python-Helfern und Python-Umgebung. Kataloge zentral unter ~/.aos/fuel/catalogs; keine Links zu Quellrepos. Stage/Prod bauen keine Frontends im Ziel. Dry-run ergänzt.
