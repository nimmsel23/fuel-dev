# NEXT.md

Aktive Arbeitsliste (max. 5 Punkte).

## 2026-09-06

- [x] Redundanz Food-Tab vs. Katalog-Tab geklärt (2026-09-06): beide rendern
  weiterhin `FoodCatalog`, aber der Food-Verlauf (unkuratierte Inbox) erscheint
  nur im Food-Tab (`showHistory`-Prop), Katalog-Tab zeigt nur den reinen
  Gerichte-Katalog. Bewusst gewollte Teil-Redundanz, kein Cleanup mehr nötig.
- [x] Ernährungsprotokoll-Report gebaut (2026-09-06): Tab `report` ("Protokoll"),
  `views/Report/NutritionReportView.jsx`. 7-/14-Tage-Protokoll, Vormittag/
  Nachmittag/Abend-Gruppierung, Makro-% + Tageskalorien, Druck/PDF. Deckt die
  FFA-Aufgaben Task 1 / 19 / 147 ab. Nächster Schritt: 14 Tage echte Daten
  loggen, dann Report gegen die Leitfaden-Vorlage feinjustieren.
- [x] Mikros + Zutaten aus dem Schätz-Call ins JSON geschrieben (2026-09-06,
  Commit `7c35d7e`): Log-Eintrag + Catalog-Entry bekommen `micros` +
  `micros_meta` + normalisierte `components` (`amount_g` geparst). Nächste
  Stufe: Zutaten-Mikroprofil pro 100 g auflösen (OFF zuerst, LLM-Fallback,
  ein Call pro neuer Zutat) → `components[].per_100g.micros` füllen,
  `micros_source` setzen; dann Mahlzeiten-Mikros bottom-up summieren statt
  `method:"meal_estimate"`.
- [ ] Zwei Dubletten `meal_basmati_reis_mit_brokkoli` / `_2` in
  `catalogs/nutrition/catalog.json` (aus den `fuel`-Läufen 13:38/13:39)
  konsolidieren + Log-Einträge 09-05/09-06 angleichen.
- [ ] Tab-Modularisierung `main.jsx` weiterführen (siehe CLAUDE.md "Open / Planned").
- [ ] Offene Diplom-Hits (Taskwarrior): "7 Tage Makronutrient-Protokoll",
  "40 Training-Einheiten protokollieren", "Sturzprophylaxe Konzept" — überfällig
  scheduled, blockieren laut Regel weitere Dev-Arbeit.

## 2026-07-18

- **Sehr viele weitere `.bak`-Dateien im ganzen Repo gefunden** (weit über 80, u. a. in `.archiv/`, `.bak/`, `bin/`, `fuel/`, `gas/`, `scripts/`, `src/server/`, root-level Configs). Nicht angefasst — lag außerhalb des TODO-Scopes ("db-Umfeld"). Vor einem breiteren Cleanup: einzeln prüfen, ob `.archiv/` und `.bak/` bewusste Archiv-Ordner sind (vermutlich ja) vs. verstreute `.bak`-Dateien in aktiven Verzeichnissen (`src/server/routes/`, `bin/`) die vermutlich echte Leichen sind.
- **Vorsicht bei "toter Code"-Verifikation in fuel-dev:** `src/client/lib/db/index.js` sah tot aus (kein Importer in `fuel-dev/src`), war aber über Vite-Aliase (`@db`/`@utils` in `vite.config.cjs`) eine Abhängigkeit für die Cross-Repo-Views `HabitVosView.jsx`/`JournalVosView.jsx` (die `habits-dev`/`journal-dev` per `@habits`/`@journal` einbinden). Grep-basierte Dead-Code-Suche muss bei fuel-dev **immer** auch `~/habits-dev/src` und `~/journal-dev/src` mitprüfen, nicht nur `fuel-dev/src` selbst — sonst false positive.
- `src/client/lib/api.js` (ohne local/cloud-Suffix) scheint ebenfalls unbenutzt (nichts importiert `lib/api` direkt, alles läuft über `@api` → `api.local.js`/`api.cloud.js`) — nicht verifiziert/gelöscht, nur aufgefallen bei der Suche.
- `client/lib/db/firestore/utils.js::randomId()` ist vermutlich ungenutzter toter Code (kein direkter Importer gefunden, Format unterscheidet sich von `shared/utils/ids.mjs::randomId()`, das der Server aktiv nutzt). Nicht gelöscht — nach dem `db/index.js`-Fehltritt heute bewusst vorsichtig, erst mit Cross-Repo-Grep (`habits-dev`, `journal-dev`, ggf. `vitalos`) sauber verifizieren, bevor angefasst wird.
- Nach dem `todayISO()`-Fix: Bestehende Log-Einträge, die vor dem Fix zwischen 00:00–02:00 Uhr lokaler Zeit ohne explizites `date`-Param angelegt wurden, könnten auf dem falschen (Vor-)Tag liegen. Kein automatischer Korrekturlauf gemacht — falls Datenqualität in `~/.aos/fuel/nutrition/` auffällt, dort gezielt nach Einträgen mit `created_at`-Zeitstempel kurz nach Mitternacht suchen.
