# RESULTS.md

Session-Log mit datierten Ergebnis-Bullets.

## 2026-09-06 (Nachtrag 3: Mikros + Zutaten ins JSON)

- `fuel "<desc>"` verwarf bisher alles außer den 4 Makros. Derselbe
  Gemini-/Haiku-Call (`estimate_nutrition`, `PROMPT_TEMPLATE`) liefert schon
  `macros` + `micros` (24 DACH-Werte) + `components` — `estimate_macros_only`
  hat nur die Makros durchgereicht.
- `fuel/meal.py`: `_parse_macros_with_gemini` nutzt jetzt die Vollschätzung.
  `do_meal_log` schreibt `micros` + `micros_meta`
  (`{source, method:"meal_estimate", resolved_at}`) und normalisierte
  `components` in den Log-Eintrag (`~/.aos/fuel/nutrition/<date>.json`) und —
  bei `--save-catalog` — in den Catalog-Entry.
- `fuel/catalog_lookup.py`: `save_meal` bekommt kwargs `micros`/`components`
  und schreibt sie in die git-/Firestore-getrackte `catalog.json`.
  `_normalize_components` parst `amount_g` aus Geminis `qty`-Freitext, legt
  `per_100g`/`micros_source` als Platzhalter an; `yield_g` = Summe der
  Zutaten-Gramm.
- Terminal-Output jetzt informativ: volle Makrozeile, Mengen-Annahme
  (Text vs. Ø-Portion), Rohgewicht-Hinweis bei Trockenware, Zutatenliste,
  Micro-Anzahl, Tages-Zwischensumme.
- **Noch offen:** Zutaten-Mikroprofile pro 100 g (echte Ingredient-DB) —
  braucht einen Resolve-Call pro Zutat, markiert via `micros_source: null`.
- Getestet mit gefaktem `estimate_nutrition`-Return + Syntax/Import — kein
  echter LLM-Call verbraucht. Commit `7c35d7e`.

## 2026-09-06 (Nachtrag 2: Ernährungsprotokoll-Report)

- Neuer Tab `report` ("Protokoll", `FileText`) nach `Historie` — abgabefertiges
  7-/14-Tage-Ernährungsprotokoll für die FFA-Aufgaben (Ernährungstrainer
  Task 1 „7 Tage Makronutrient-Protokoll" + Task 19 „14 Tage Diät-Protokoll",
  Fitnesstrainer-Zusatzaufgabe Task 147). `src/client/views/Report/NutritionReportView.jsx`.
- Rein clientseitig über `fetchJson("/nutrition/history?limit=180")` (@api →
  Fastify lokal / Firestore cloud), kein neuer Server-Endpoint. Der in
  CLAUDE.md geplante `GET /nutrition/export?from=&to=` bleibt damit unnötig.
- Ausgabe: weißes „Blatt" (`.report-sheet` in `styles.css`, sichtbar wie
  gedruckt), pro Tag Tabelle Nahrungsmittel/Getränk × kcal/KH/Fett/EW,
  gruppiert nach Vormittag (<12) / Nachmittag (12–17) / Abend (≥17) aus dem
  `time`-Feld (Fallback über `meal.type`), Slot-Zwischensummen + Tages-
  Gesamtkalorien + energetische Makro-Verteilung (%). Deckblatt mit Name
  (localStorage), Zeitraum, Erhebungsmethode; Auswertungstabelle mit Ø/Tag.
- Zeitraumwahl: Presets 7 / 14 Tage / frei (Von–Bis). Tage ohne Log werden
  als „Keine Einträge" ausgewiesen. Druck via `window.print()`, Print-CSS in
  `styles.css` (`@media print`: Header/Nav weg, `@page`-Rand, Seitenumbruch
  alle 3 Tage).
- `build:local` + `build:cloud` grün, eigener Lazy-Chunk `NutritionReportView`.

## 2026-09-06 (Nachtrag: Tab-Reihenfolge + Katalog-Trennung)

- Tab-Reihenfolge auf User-Vorgabe umgestellt (`routes.js`):
  Dashboard · **Log** · Food · **Rezepte** · **Katalog** · Historie · Journal ·
  Supplements · Mikros · Setup · Dev. Log wandert direkt hinter Dashboard,
  Rezepte steht zwischen Food und Katalog.
- Food-Verlauf (unkuratierte Inbox „Noch nicht kuratiert") bleibt nur im
  Food-Tab: `FoodCatalog` bekommt Prop `showHistory` (Default `true`), die
  History-Inbox-Query ist per `enabled: showHistory` gated. `CatalogView`
  rendert `<FoodCatalog showHistory={false} />` → reiner Gerichte-Katalog.
- `build:local` + `build:cloud` grün.

## 2026-09-06

- Rezept-Builder aus `FoodView` herausgelöst: Komponente nach
  `src/client/views/RecipeBuilder/RecipeBuilder.jsx` verschoben, neue
  `src/client/views/RecipeBuilderView.jsx` (thin wrapper, `max-w-3xl`), eigener
  Tab `recipes` ("Rezepte", `ChefHat`) in `routes.js` nach dem Food-Tab.
- Katalog zusätzlich als eigene View + Tab: `src/client/views/CatalogView.jsx`,
  Tab `catalog` ("Katalog", `Library`). `FoodCatalog` bleibt weiterhin auch in
  `FoodView` eingebunden (bewusst redundant lt. Ansage).
- Header-Nav (Tab-Pills unter dem Date-Picker) wrappt jetzt statt horizontal zu
  scrollen: `<nav>` von `overflow-x-auto snap-*` auf `flex flex-wrap gap-2`,
  Pills ohne `shrink-0 snap-start` (`main.jsx`).
- `build:local` + `build:cloud` grün.

## 2026-09-03

- Firestore-Status im Fuel-Prod-Health-Payload und in `bin/fuelctl` getrennt:
  `pushCount` bleibt als Gesamtzähler bestehen, zusätzlich gibt es jetzt
  `catalogPushCount` und `runtimePushCount`. Die Dev-Ansicht zeigt dieselbe
  Aufteilung, damit `pushes=...` nicht mehr als unscharfer Sammelwert erscheint.
- Die sichtbare CLI-/npm-Frontdoor wurde von `sync` auf `cloud` umbenannt
  (`fuelctl cloud`, `fuel cloud`, `npm run cloud:{push,pull,watch}`), weil der
  bisherige Name semantisch zu eng bzw. irreführend war. Deprecated
  `sync:*`-npm-Skripte bleiben als Alias vorerst erhalten.
- Ein neuer echter `sync` wurde separat eingeführt:
  `fuelctl sync <uid>` bzw. `npm run catalog:sync -- <uid>`. Dieser Pfad
  gleicht nur Catalog-Daten ab und übernimmt nur fehlende oder neuere Einträge
  zwischen lokal und Firestore; Löschungen werden dabei bewusst nicht
  propagiert.
- Erkenntnis zur Semantik des bestehenden Firestore-Systems dokumentiert:
  Der Catalog-Pfad ist fachlich kein echter `sync`, sondern ein
  Vollschreib-/Publish-Pfad pro Zieldokument
  (`nutrition/<uid>/meta/catalog`, `supplements/<uid>/meta/catalog`).
  Bei jedem erfolgreichen Catalog-Push wird das komplette Catalog-Dokument neu
  nach Firestore geschrieben, nicht nur ein Delta.
- Der Runtime-Pfad (`nutrition/logs`, `nutrition/journal`, `supplements/logs`)
  bleibt der eigentliche Sync-Pfad. Er enthält Push/Pull/Pushback-Verhalten,
  einschließlich Self-Heal-Writebacks nach Enrichment oder Mikro-Resolution.

## 2026-08-07 (v4-Merge)

- `~/fuel/` (Python/FastAPI + Postgres, v4.0.0-Frontend) komplett nach hierher
  gemerged: `frontend/` + `backend/` (Code), plus Rest (`alembic/`, `main.py`,
  `pyproject.toml`, `docker-compose.yml`, Docs, `scripts/`) unter `backend/`.
  `.env` mit echtem `GEMINI_API_KEY` bewusst nicht kopiert (Credential-Leakage-Risiko).
- v3↔v4 Cross-Reachability-Proxies gebaut: `src/server/routes/v4-proxy.mjs`
  (`/v4/*`), `backend/api/endpoints/v3_proxy.py` (`/v3/*`) — reine Erreichbarkeit,
  kein gemeinsamer Datenlayer. Der Übergang ist bidirektional: v3 kann an v4
  weiterreichen, und v4 kann Legacy im Zweifel an v3 zurückdelegieren.
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
