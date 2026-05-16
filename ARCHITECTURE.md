# Fuel Centre — Architektur

Stand: 2026-05-06

---

## Was steht (implementiert)

### Server (`server.mjs`, Port 9000)

Plain Node.js `http` — kein Framework. Routing per `if`-Kette auf normalisierten Pfaden.
Daten: dateibasiertes JSON unter `~/.aos/fuel/` (via `AOS_FUEL_DATA_DIR` ENV-Var, default: `~/.aos/fuel`).
Bridge proxied `/api/fuel/*` zu diesem Server mit Fallback auf lokale water-logging.

```
GET  /health
GET  /nutrition/search?q=&limit=    ← OFF-Proxy (https, kein externer Dep)
GET  /nutrition/log?date=
POST /nutrition/log                 ← meal{type,description,kcal,protein,carbs,fat} + water_ml
GET  /nutrition/catalog
POST /nutrition/catalog             ← wiederverwendbare Gerichte/Mahlzeiten
GET  /nutrition/journal?date=
POST /nutrition/journal
GET  /nutrition/journal/list
GET  /supplements/catalog
POST /supplements/catalog
GET  /supplements/log?date=
POST /supplements/log               ← intake{} oder delete_id
GET  /supplements/stats?days=&anchor=
GET  /fuel/log (legacy)
GET  /fuel/progress (legacy)
POST /fuel/log (legacy)
GET  /v2                            ← V2-Preview-HTML oder Vite-Build-Index
```

Pfad-Normalisierung: `/c/<id>/nutrition/…` und `/<prefix>/nutrition/…` werden auf
`/nutrition/…` reduziert — für vital-hub-Klienten-Routing vorbereitet.

### V1 / Fuel Classic (`public/index.html`)

Vanilla-HTML-PWA: Mahlzeiten, Journal, Supplements, Supplement-Stats.
Kein Build-Schritt. SW (`public/sw.js`): Cache-first für statische Assets,
network-first mit Fallback für API-Pfade (`/health`, `/fuel/`, `/nutrition/`, `/supplements/`).
**Kein Offline-Write-Through** — schlägt der POST fehl, wird nichts gepuffert.

### V2 / Fuel Studio (`src/main.jsx` + Vite)

React 18, Tailwind 3, TanStack Query, FullCalendar, Recharts, Zustand, Zod, RHF.

Tabs: Dashboard · Big Calendar · Journal · Supplements · Settings.

**Food Search (Journal-Tab):**
- Eingabe → debounced 350 ms → `GET /nutrition/search`
- Dropdown: Name, Brand, Kcal/KH/Fett/EW pro 100 g
- Portionsgröße: S 100 g / M 200 g / L 300 g / XL 450 g
- Auto-fill: description, kcal, protein, carbs, fat im Meal-Logger-Formular
- Optional: "Als Gericht speichern" schreibt einen wiederverwendbaren Eintrag nach
  `data/nutrition/catalog.json`; Katalogeinträge können direkt wieder geloggt werden.
- Composite meals/menus can carry a `components[]` array; the server stores the
  summed macros and keeps the component list on the catalog item and the day log.

### CLI-Backend (`~/Nutrition/`)

Kein Node — reines Bash/Python, unabhängig vom Server.

| Tool | Was |
|------|-----|
| `wger-food` | OFF-Suche → fzf → S/M/L/XL → Markdown-Zeile in `~/Nutrition/logs/YYYY-MM-DD.md` |
| `wger-generate` | 14-Tage-Protokoll ~2800 kcal/Tag für Ausbildung, deterministisch per Datum-Seed |

Doku: [NUTRITION.md](NUTRITION.md)

### Docker: wger (lokal, Port 8000)

Läuft als `docker-web-1`. Ingredient-DB war leer; `sync-ingredients` schlug wegen
Versionskonflikt (lokal `2.5.0a2` < Remote-Minimum `2.5.0`) fehl.
Aktuell nicht als Datenquelle genutzt — OFF übernimmt diese Rolle.

---

## Was noch nicht steht (geplant / offen)

### Offline Write-Through (POST-Queue)

Der SW puffert GET-Responses, aber keine fehlgeschlagenen POSTs.
Ziel: Background Sync API (`sync`-Event im SW) — bei Offline-POST in IndexedDB
queuen, beim Reconnect flushen.

Vorbild: `~/core4-dev/public/offline-queue.js` (bereits gebaut für Core4).
Kandidat für Drop-in in `public/sw.js` + `public/index.html`.

### CLI ↔ API Datenschema-Angleichung

Aktuell zwei parallele Datenpfade:
- CLI schreibt Markdown → `~/Nutrition/logs/YYYY-MM-DD.md`
- API schreibt JSON → `data/nutrition/YYYY-MM-DD.json`

Sinnvoller nächster Schritt: `wger-food` optional per `POST /nutrition/log`
schreiben lassen (Flag `--api`), damit CLI- und Web-Logs im selben Store landen.

### vital-Klienten-Integration

`normalizeRoutedPath` ist bereits vorbereitet für `/c/<clientId>/nutrition/…`.
Fehlt: Auth-Schicht (welcher Klient darf welche Daten lesen) und Klienten-aware
Datenpfade (`data/nutrition/<clientId>/YYYY-MM-DD.json`).

### wger local als Primärquelle

Sobald `sync-ingredients` erfolgreich durchläuft (Version gepatcht auf `2.5.0`),
kann `server.mjs` bei `/nutrition/search` erst lokal anfragen und nur bei 0 Treffern
auf OFF fallen. Vorteil: keine externe Abhängigkeit, eigene Daten erweiterbar.

### habitsync

War im alten README als Docker-Kandidat genannt. Noch nicht evaluiert.
Relevant wenn Habit-Tracking (Streaks, Gewohnheiten) tiefer integriert werden soll.
Bis dahin: Supplement-Streak via `/supplements/stats` als Ersatz.

### Export / Backup

Kein Export-Endpoint. Für die Ausbildungsabgabe: `wger-generate --days 14`
erzeugt die Markdown-Tabelle direkt. Für längerfristigen Einsatz fehlt:
- `GET /nutrition/export?from=&to=` → CSV oder Markdown
- automatisches Backup nach `~/.aos/` (Bridge-Sync-Schicht)

---

## CLI-Tools & Universal Logging

### `fuel` CLI (Python/Typer)

**File**: `~/fuel-dev/fuel`

Python/Typer-basierte Supplement-Logging CLI mit automatischen zsh-Completions.

```bash
fuel log melatonin --yesterday           # Supplement mit default dose
fuel log melatonin 2 --time morning      # Custom dose
fuel log melatonin kollagen zink         # Multiple supplements
fuel today [--day YYYY-MM-DD]            # Tagesübersicht
fuel list                                # Catalog anzeigen
fuel week [--date YYYY-MM-DD]            # Wochenreport + CSV-Export
fuel --help                              # Shows full catalog inline
```

**Features**:
- Typer + loguru + gum für saubere Fehlerbehandlung
- Dynamischer help-text mit Catalog-Auflistung (kein "z.B. melatonin")
- Automatische zsh-Completions (via Typer `add_completion=True`)
- Supplements aus `~/.aos/fuel/supplements/catalog.json`
- Logs zu `~/.aos/fuel/supplements/logs/YYYY-MM-DD.json`

**Shortcuts für Kompatibilität**:
- `fuel melatonin` → shortcut für `fuel log melatonin` (detect via callback)
- `--yesterday`, `--1d`, `--2d` → converted zu `--day <date>` via pre-parser

### `hab` Universal Dispatcher

**File**: `~/.dotfiles/logger/hab` (symlink: `~/.dotfiles/bin/hab`)

Auto-detecting dispatcher für alle Habit/Intake-Domains (Fuel, Nutrition, Fitness).

```bash
hab melatonin --yesterday                # Auto → fuel log melatonin
hab melatonin kollagen zink --yesterday  # Multiple → fuel log ... (grouped)
hab apple 100g                           # Auto → fuel nutrition apple 100g (future)
hab barbell_bench 5x5 100kg              # Auto → fitness log barbell_bench ... (future)
```

**Architecture**:
1. Loads all catalogs (supplements, nutrition, workouts)
2. Parses items vs. options from args
3. Categorizes each item (supplement / nutrition / workout)
4. Routes grouped by category with shared options

**Features**:
- loguru + gum for clean output (ANSI fallback)
- Supports multiple items in one command
- Automatically routes to correct CLI
- Works with future domains (fitness, nutrition, stress, sleep, etc.)

**Why `hab`?** `log` is a reserved zsh built-in. `hab` (habit/have) is shorter, thematic, and collision-free.

---

See also: `~/.dotfiles/logger/README.md` for detailed dispatcher documentation.
