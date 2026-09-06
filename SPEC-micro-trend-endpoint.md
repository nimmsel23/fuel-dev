# SPEC — Mikro-Trend-Detail-Endpoint

Status: **v3 implementiert** (2026-09-06, Commit `b636f58`). Route + `assembleWeek()`-Extraktion
live, per Handler-Harness + HTTP-Smoke (Port 9009) gegen echte Daten verifiziert. Noch offen:
Deploy auf `/opt/fuel` (`npm run deploy:local`), Cloud-Client-Drilldown, v4-Variante (s.u.).

## Ziel

Eine API, die den Wochen-Verlauf **eines** Mikronährstoffs samt Beitrags-Aufschlüsselung
als JSON liefert — die Datengrundlage für die „Vit. C (mg) — Tagesverlauf"-Detailansicht
(Balken pro Tag, Ø/Tag, DACH-Ref, % erreicht, Top-Beiträge der Woche, Beiträge pro Tag).

Konsument: lokaler Coach-Channel, `curl`, Telegram-Reports, Wochen-Auswertungs-Skripte.
(Cloud-PWA rechnet dieselbe Sicht client-seitig aus Firestore — separates Ticket.)

## Route

```
GET /nutrition/weekly/:year/:week/micro/:key
```

- `:year` — vierstellig, `:week` — ISO-KW 1..53 (Guards wie in `weekly.mjs`).
- `:key` — akzeptiert
  - kanonisch: `vitamin_c_mg`, `zinc_mg`, `folate_ug` …
  - Slug: `vitamin-c`, `vit-c`, `zink`, `folat`, `omega-3` …
  - Auflösung über Alias-Map, die beim Modul-Load aus `DACH` (`src/shared/config/dach.mjs`)
    generiert wird: pro Key → kanonische Form, Bindestrich-Form, einheitslose Form
    (`_mg`/`_ug` gestrippt), Label-Slug (`"Vit. C"` → `vit-c`).
  - kein Treffer → `400 { ok:false, error:"Unknown micro key '<raw>'", known:[…] }`.

Optionaler Query-Param: `?limit=` (Default 20) — Kappung von `top_contributors`.

Nice-to-have Alias: `GET /nutrition/weekly/kw:week/micro/:key` (Jahr = aktuelles).

## Response

```jsonc
{
  "ok": true,
  "year": 2026,
  "week": 31,
  "micro": { "key": "vitamin_c_mg", "label": "Vit. C", "unit": "mg" },

  "dach_ref": 155,            // DACH-Tagesreferenz (dashed line im Chart)
  "total_week": 197.4,
  "avg_daily": 28.2,          // total_week / 7
  "percent_of_dach": 18,      // round(avg_daily / dach_ref * 100)
  "status": "critical",       // getStatus(avg_daily, dach_ref): ok | warning | critical

  "timeline": [               // genau 7 Einträge, Mo..So, chronologisch
    { "date": "2026-07-26", "value": 5.3 },
    { "date": "2026-07-27", "value": 2.2 },
    { "date": "2026-07-29", "value": 118.0 },
    …
  ],

  "top_contributors": [       // ganze Woche, value>0, absteigend, tie-break date asc, cap = limit
    { "name": "Hühnerfleisch mit Erdäpfeln in Olivenöl", "kind": "meal",       "date": "2026-07-29", "value": 69.0 },
    { "name": "2 kleine Erdäpfel (ca. 250g)",            "kind": "meal",       "date": "2026-07-29", "value": 49.0 },
    { "name": "Erdbeerroulade Jomo 300gr",              "kind": "meal",       "date": "2026-08-01", "value": 45.0 },
    { "name": "Zink-Komplex",                            "kind": "supplement", "date": "2026-07-30", "value": 25.0 }
  ],

  "day_contributions": [      // 1 Eintrag pro Wochentag, chronologisch (deckt sich mit timeline)
    {
      "date": "2026-08-01",
      "total": 47.3,
      "items": [             // absteigend nach value; percent = round(value/total*100)
        { "name": "Erdbeerroulade Jomo 300gr", "kind": "meal", "value": 45.0, "percent": 95 },
        { "name": "10 Freilandeier angebraten …", "kind": "meal", "value": 1.3, "percent": 3 },
        { "name": "2 Leberkäsesemmeln", "kind": "meal", "value": 1.0, "percent": 2 }
      ]
    }
  ],

  "contributions_available": true   // v4: false, solange keine Pro-Mahlzeit-Mikros persistiert werden
}
```

Rundung wie in `weekly.mjs`: Werte 1 Nachkommastelle, `percent`/`percent_of_dach` ganzzahlig.
`kind` ist `"meal"` | `"supplement"`; Icon (🍽/💊) ist Client-Sache.
Zukunfts-/Leerwoche → `200` mit Null-`timeline` und leeren `items`, **nicht** `404`.

## Umsetzung — v3 Node (empfohlen)

Die komplette Datengrundlage entsteht **bereits** in `src/server/routes/nutrition/weekly.mjs`:

| Response-Feld hier | Quelle in `weekly.mjs` |
|---|---|
| `timeline[].value` | `day_breakdown[date][key]` |
| `dach_ref`, `avg_daily`, `total_week`, `percent_of_dach`, `status` | `rda_comparison[key]` |
| `top_contributors`, `day_contributions[].items` | `meal_breakdown[date][]` → `{kind,name,micros,micros_meta}` projiziert auf `micros[key]` |

`meal_breakdown` enthält Mahlzeiten **und** dosis-skalierte Supplement-Beiträge
(`addSupplementMicros`, Faktor `intake.dose / entry.default_dose`).

Schritte:

1. **Refactor:** die Wochen-Assembly (die `for (const date of dates)`-Schleife + Status-Build)
   aus dem Route-Handler in eine wiederverwendbare Funktion ziehen:
   `src/server/services/nutrition-weekly.mjs`
   ```js
   export async function assembleWeek(year, week, ctx) {
     // ctx = { paths, uid }
     // → { dates, week_totals, rda_comparison, day_breakdown, meal_breakdown }
   }
   ```
   `weekly.mjs` wird zum dünnen Aufrufer davon (Verhalten unverändert, Regressionstest:
   Response-Diff `/nutrition/weekly/2026/31` vor/nach = leer).

2. **Neue Route:** `src/server/routes/nutrition/micro-trend.mjs`
   - `resolveMicroKey(raw)` (Alias-Map s.o.)
   - `assembleWeek(...)` rufen
   - auf `key` projizieren, `top_contributors` flach über 7 Tage sammeln + sortieren
   - `day_contributions` aus `meal_breakdown` mit `percent` anreichern
   - registrieren in `src/server/routes/nutrition/index.mjs`

3. **Tests:** `resolveMicroKey`-Tabelle (kanonisch/Slug/Label/unbekannt),
   Projektion gegen einen Fixture-Wochen-Response, `percent`-Summe ≤ 100 (+Rundungsdrift),
   Leerwoche → Nullstruktur.

Aufwand: ~1–2 h. Kein neues Caching nötig (`assembleWeek` self-healt den Pro-Tag-`micro_totals`-Cache
schon).

## Umsetzung — v4 Python (degraded, optional)

`backend/api/endpoints/nutrition_query.py`, neue Route analog. **Sofort lieferbar** aus
vorhandenen Daten (`get_weekly_micros` rechnet `day_breakdown` / `rda_comparison` bereits):
`timeline`, `avg_daily`, `dach_ref`, `percent_of_dach`, `status`, `total_week`.

**Nicht lieferbar ohne Schema-Änderung:** `top_contributors`, `day_contributions[].items`.
v4 wirft Pro-Mahlzeit-Mikros bewusst weg (`backend/api/endpoints/food.py`:
„micros werden absichtlich nicht pro Mahlzeit gespeichert (Speicheroptimierung)") — es
überlebt nur `journal.micros_sum` (Tagesebene).

Für Parität nötig (Empfehlung Variante a):
- **a)** in `log_food` `micros` an jeden `food_logs[]`-Eintrag hängen (Kommentar
  „Speicheroptimierung" streichen — bei Single-User vernachlässigbar), dann Beiträge aus
  `journal.food_logs[].micros[key]` + `journal.habits[]` gegen `SupplementCatalogItem.micros`
  skaliert (Analogon zu `addSupplementMicros`) bauen. Optional Backfill aus v3.
- **b)** separate Spalte `micro_contributions` `{key: [{name,kind,value}]}` neben `micros_sum`.

Bis dahin: `top_contributors: []`, `day_contributions: [{date,total,items:[]}]`,
`contributions_available: false`.

### Nebenbefund v4 (unabhängig fixen)

`backend/api/endpoints/supplements.py` (~Z. 574) schreibt
`journal.micros_sum[habit_dict["name"]] += dose` — keyed nach Supplement-**Name** mit roher
**Dosis**, nicht nach Mikro-Key. Für `MICRO_KEYS`-gefilterte Reads harmlos, aber:
**Supplement-Mikros landen in v4 nie in `micros_sum`** → v4-Wochenzahlen sind aktuell
mahlzeiten-only. v3 macht es korrekt (`addSupplementMicros`).

## Empfehlung

In **v3 Node** bauen — Daten sind da, Endpoint ≈ Projektions-Layer + Key-Resolver +
`assembleWeek`-Extraktion. v4 braucht zuerst Pro-Mahlzeit-Mikro-Persistenz (+ Supplement-Fix),
sonst bleibt der Beitrags-Teil leer.
