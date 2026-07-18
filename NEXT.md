# NEXT.md

Aktive Arbeitsliste (max. 5 Punkte).

## 2026-07-18

- **Sehr viele weitere `.bak`-Dateien im ganzen Repo gefunden** (weit über 80, u. a. in `.archiv/`, `.bak/`, `bin/`, `fuel/`, `gas/`, `scripts/`, `src/server/`, root-level Configs). Nicht angefasst — lag außerhalb des TODO-Scopes ("db-Umfeld"). Vor einem breiteren Cleanup: einzeln prüfen, ob `.archiv/` und `.bak/` bewusste Archiv-Ordner sind (vermutlich ja) vs. verstreute `.bak`-Dateien in aktiven Verzeichnissen (`src/server/routes/`, `bin/`) die vermutlich echte Leichen sind.
- **Vorsicht bei "toter Code"-Verifikation in fuel-dev:** `src/client/lib/db/index.js` sah tot aus (kein Importer in `fuel-dev/src`), war aber über Vite-Aliase (`@db`/`@utils` in `vite.config.cjs`) eine Abhängigkeit für die Cross-Repo-Views `HabitVosView.jsx`/`JournalVosView.jsx` (die `habits-dev`/`journal-dev` per `@habits`/`@journal` einbinden). Grep-basierte Dead-Code-Suche muss bei fuel-dev **immer** auch `~/habits-dev/src` und `~/journal-dev/src` mitprüfen, nicht nur `fuel-dev/src` selbst — sonst false positive.
- `src/client/lib/api.js` (ohne local/cloud-Suffix) scheint ebenfalls unbenutzt (nichts importiert `lib/api` direkt, alles läuft über `@api` → `api.local.js`/`api.cloud.js`) — nicht verifiziert/gelöscht, nur aufgefallen bei der Suche.
- `client/lib/db/firestore/utils.js::randomId()` ist vermutlich ungenutzter toter Code (kein direkter Importer gefunden, Format unterscheidet sich von `shared/utils/ids.mjs::randomId()`, das der Server aktiv nutzt). Nicht gelöscht — nach dem `db/index.js`-Fehltritt heute bewusst vorsichtig, erst mit Cross-Repo-Grep (`habits-dev`, `journal-dev`, ggf. `vitalos`) sauber verifizieren, bevor angefasst wird.
- Nach dem `todayISO()`-Fix: Bestehende Log-Einträge, die vor dem Fix zwischen 00:00–02:00 Uhr lokaler Zeit ohne explizites `date`-Param angelegt wurden, könnten auf dem falschen (Vor-)Tag liegen. Kein automatischer Korrekturlauf gemacht — falls Datenqualität in `~/.aos/fuel/nutrition/` auffällt, dort gezielt nach Einträgen mit `created_at`-Zeitstempel kurz nach Mitternacht suchen.
