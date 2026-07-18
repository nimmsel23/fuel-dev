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
