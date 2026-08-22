# Fuel Centre — Architektur

Stand: 2026-05-29

---

## Überblick

Hybrid-Architektur für maximale Flexibilität:
- **Lokal:** Fastify-Backend (Port 9000), JSON-Speicher in `data/`, SQLite Caches.
- **Cloud:** Firebase Hosting & Firestore. Ermöglicht 24/7 Nutzung der PWA unabhängig vom Laptop.
- **Sync:** Bidirektionaler Abgleich zwischen lokalem Dateisystem und Firestore.

---

## Daten-Layer & API-Routing

Die App nutzt in `src/lib/api.js` eine intelligente Weiche:

1.  **Detection:** Läuft die App auf `*.web.app` oder `*.firebaseapp.com`?
2.  **Routing:**
    -   **Lokal:** Requests gehen an den Node-Server (`/nutrition/...`).
    -   **Cloud:** Requests werden auf Firestore-Calls umgeleitet (`src/lib/db.firestore.js`).
    -   **Fallback:** Wenn der lokale Server nicht erreichbar ist, kann auch lokal auf Firestore ausgewichen werden.

---

## Backend (`src/app.mjs`)

**Fastify** mit `@fastify/cors`. Plugins in `src/routes/`.
Path-Normalisierung per `preHandler`-Hook: `/c/<clientId>/...` → bare path.

### Routing

```
GET  /health

# Nutrition
GET  /nutrition/search?q=&limit=       Open Food Facts proxy
GET  /nutrition/log?date=              Tages-Logs (YYYY-MM-DD.json)
POST /nutrition/log                    {meal: {description, catalog_id?, kcal, protein, carbs, fat}}
GET  /nutrition/catalog                Alle Meals aus catalogs/nutrition/meals/
POST /nutrition/catalog                Meal als {id}.json speichern
GET  /nutrition/daily/:date            Aggregierte Makros + Mikros für einen Tag
GET  /nutrition/weekly/:year/:week     Wochen-Mikros vs. DACH-Referenz
POST /nutrition/compose                wger + Gemini → Gericht komponieren, optional speichern
POST /nutrition/estimate               Gemini Makro-Schätzung ohne Save
GET  /nutrition/journal?date=
POST /nutrition/journal

# Supplements
GET  /supplements/catalog
POST /supplements/catalog
GET  /supplements/log?date=
POST /supplements/log
GET  /supplements/stats?days=&anchor=

# Push Notifications (Habit Tracker)
GET  /push/vapidPublicKey
POST /push/subscribe

# Legacy
GET|POST /fuel/log
```

---

## Datenspeicherung

### Laufzeit-Daten (`data/catalogs/`)

```
~/.aos/fuel/
├── nutrition/
│   ├── YYYY-MM-DD.json     Tages-Mahlzeiten
│   └── nutrition.db        SQLite (ingredients + meal_micros)
├── nutrition_journal/
│   └── YYYY-MM-DD.md
└── supplements/
    └── logs/
        └── YYYY-MM-DD.json
```

### Repo-Kataloge (`catalogs/`, git-tracked)

```
catalogs/
├── nutrition/
│   └── meals/
│       └── {id}.json       Ein File pro Gericht
└── supplements/
    └── catalog.json
```

Catalogs sind im Repo versioniert — portabel, backup-frei, direkt editierbar.

### SQLite (`nutrition.db`)

**`ingredients`** — wger API Cache, per 100g:
```sql
wger_id, name, brand, kcal, protein, carbs, fat, fiber, sodium_mg
```
Befüllt automatisch beim Compose.

**`meal_micros`** — Gemini-geschätztes Mikronährstoffprofil:
```sql
meal_name TEXT UNIQUE,
vitamin_b12_ug, calcium_mg, iron_mg, vitamin_d_ug, vitamin_e_mg,
folate_ug, magnesium_mg, zinc_mg, sodium_mg, potassium_mg,
source TEXT  -- 'gemini'
```
Lookup: `SELECT * FROM meal_micros WHERE meal_name = ? COLLATE NOCASE`

---

## Meal Catalog

Individuelle JSON-Files in `catalogs/nutrition/meals/`:

```json
{
  "id": "meal_eierspeise_freiland",
  "kind": "recipe",
  "category": "meal",
  "name": "Eierspeise Freiland",
  "meal_type": "meal",
  "description": "...",
  "kcal": 168, "protein": 15.1, "carbs": 0.6, "fat": 11.8,
  "components": [],
  "addons": [
    { "id": "freiland_2er", "label": "2 große Freiland-Eier", "grams": 120, "kcal": 168, ... }
  ],
  "default_addon_ids": ["freiland_2er"]
}
```

`nutrition-catalog.mjs` liest beim Start alle `*.json` aus dem Meals-Dir.
Neues Meal: `saveMeal(item)` → schreibt `{id}.json`.

---

## Supplement Habit Tracker (Push Reminders)

Supplements fungieren als tägliche Checkliste (Habits), die den User an die Einnahme erinnern.

### 1. Datenmodell (Catalog)
Im `catalog.json` werden Supplements mit einem `schedule` definiert:
- `daily`: Jeden Tag fällig
- `weekly`: Nur an bestimmten Wochentagen (z. B. `["mon", "wed"]`)
- `cyclical`: Alle X Tage (z. B. jeden 3. Tag)

### 2. UI-Logik (Due Today Checkliste)
Die PWA (V2 / Fuel Studio) berechnet on-the-fly, welche Supplements **heute** an der Reihe sind. Es wird eine Checkliste gruppiert nach Tageszeiten (Morning, Midday, Evening, Night) angezeigt. Ein Tap loggt das Supplement (Y/N).

### 3. Push-Benachrichtigungen
- **Backend:** `push-scheduler.mjs` läuft im Node-Server als minütlicher Cron-Job.
- **Triggers:** Um 08:00 (morning), 13:00 (midday), 19:00 (evening) und 21:00 (night) wird der Soll-Zustand (`schedule`) mit dem Ist-Zustand (`logs/YYYY-MM-DD.json`) abgeglichen.
- **Service Worker:** Sind noch Supplements offen, schickt der Server eine Web-Push-Notification (VAPID) an den Service Worker (`sw.js`), der das Smartphone aufweckt und den Reminder anzeigt.

---

## Mikronährstoff-Pipeline

```
User loggt Mahlzeit (via UI oder /nutrition/compose)
    │
    ├─ Makros: aus Meal-Katalog oder manuell eingegeben
    │
    └─ Mikros (async, beim Compose):
           gemini-micros "Mahlzeit-Beschreibung"
               → Gemini schätzt absolute Mikrowerte für die Portion wie gegessen
               → upsertMealMicros(mealName, micros) → SQLite meal_micros
```

**Aggregation** (weekly/daily):
1. Meal-Log laden → für jede Mahlzeit `getMealMicros(name)` aus SQLite
2. Mikros summieren → Tages-/Wochen-Totals
3. Vergleich mit DACH-Referenz (`src/config/dach.mjs`)

**Wochenheatmap** (`MicrosView.jsx`):
- 8 Wochen × 10 Mikronährstoffe
- Farbe: ≥90% grün, 50–89% amber, <50% rot, keine Daten grau
- Daten: `GET /nutrition/weekly/:year/:week` → `rda_comparison`

---

## Gemini Integration

Alle drei Scripts sind eigenständige Python-Executables im Repo-Root:

| Script | Input | Output |
|--------|-------|--------|
| `gemini-compose` | Mahlzeit-Beschreibung | `{kcal, protein, carbs, fat, components[]}` |
| `gemini-estimate` | Mahlzeit-Beschreibung | `{kcal, protein, carbs, fat}` |
| `gemini-micros` | Mahlzeit-Beschreibung | `{vitamin_b12_ug, calcium_mg, ...}` (absolute Werte) |

Config: `~/.env/fuel.env` (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`)

---

## Frontend

### V1 / Fuel Classic (`public/index.html`)
- Vanilla HTML PWA, kein Build
- SW cache-first für Assets, network-first für API
- Kein Offline-Write-Through

### V2 / Fuel Studio (`src/main.jsx`)
- React 18, TailwindCSS 3, TanStack Query, FullCalendar, Recharts, Zod, Zustand
- **Tabs:** Dashboard · Food · Big Calendar · Journal · Supplements · Mikros · Setup
- **NutritionHeatmap** (Header): Wochennavigation mit Kcal-Level-Visualisierung
- **MicrosView**: DACH-Wochenheatmap (letzter 8 Kalenderwochen)

---

## Services-Übersicht

| Service | Was |
|---------|-----|
| `nutrition-db.mjs` | better-sqlite3: `ingredients` + `meal_micros` |
| `nutrition-catalog.mjs` | Meal-Files lesen/schreiben |
| `nutrition-micros.mjs` | Thin wrapper: `getMicrosForMeal`, `saveMicrosForMeal` |
| `nutrition-compose.mjs` | `gemini-compose` execFile wrapper |
| `nutrition-estimate.mjs` | `gemini-estimate` execFile wrapper |
| `nutrition-estimate-micros.mjs` | `gemini-micros` execFile wrapper |
| `nutrition-search.mjs` | Open Food Facts HTTPS proxy |
| `nutrition-log.mjs` | Tages-Log lesen/schreiben |
| `supplements-catalog.mjs` | `catalogs/supplements/catalog.json` |
| `supplements-log.mjs` | Supplement-Logs + Stats |
| `push.mjs` | Routen für VAPID Key und Subscription |
| `push-scheduler.mjs` | Cron-Job für Supplement-Reminders |
| `wger-search.mjs` | wger API Ingredient-Suche |

---

## Open

- Offline Write-Through POST-Queue (Vorbild: `~/core4-dev/public/offline-queue.js`)
- `fuel meal` CLI → schreibt via `/nutrition/log`
- Export-Endpoint: `GET /nutrition/export?from=&to=` → CSV
- Klienten-Auth für `/c/<id>/nutrition/…`

---

## v4 (Python/FastAPI + Postgres) — seit 2026-08-07

Alles oben ist **v3** (Node/Fastify + altes React-Frontend, `src/`) — aktuell der
äußere Runtime-/Kompatibilitäts-Layer. In Dev läuft v3 auf `:9000`; in Desktop-Prod
ist `fuel.service` derzeit ebenfalls noch v3 (`/opt/fuel`, Port `7000`). `backend/`
+ `frontend/` sind **v4**, aus `~/fuel/` nach hierher gemerged: der eigentliche
Nachfolger, kein Prototyp. v4 läuft lokal auf `:4000`, servt sein eigenes gebautes
`frontend/dist` und kann im Übergangszustand Legacy-Fälle zurück an v3 delegieren.

Die Migrationslogik ist **bidirektional**:
- `/v4/*` auf v3 proxied zu v4 (`src/server/routes/v4-proxy.mjs`)
- `/v3/*` auf v4 proxied zu v3 (`backend/api/endpoints/v3_proxy.py`)

Das ist reine Erreichbarkeit im Übergang, kein gemeinsamer Datenlayer. v4 behält
seine eigene Postgres-/SQLite-Seite; v3 behält seine bestehende Node/Firebase-
Kompatibilität.

Der Fuel Tracker (v4) wurde bewusst als simpel gehaltenes, modulares Python-Backend
("Prod-like") konzipiert, das sich von historisch gewachsenen Node/Python-
Mischarchitekturen verabschiedet.

### Kern-Architektur

1. **Python 3 Backend**: Verwaltet durch Poetry für striktes Dependency-Management (`backend/pyproject.toml`).
2. **Relationales Datenmodell (PostgreSQL)**: Single-Point-of-Truth für alle getrackten Mahlzeiten (SQLite als reiner Dev-Fallback, an `backend/` geankert, siehe `backend/core/config.py`).
3. **LLM als "Intelligenter Parser"**: Gemini API übersetzt natürlichen Text in harte Makro-Fakten statt einer internen Nährwert-Suchmaschine.

### Verzeichnisstruktur

```text
fuel-dev/
├── backend/                 # Python-Package (FastAPI + SQLAlchemy)
│   ├── .agents/              AlphaOS Meta-Instruktionen
│   ├── alembic/               DB-Migrations-Historie
│   ├── api/                   FastAPI Router (food, supplements, journal, ..., v3_proxy)
│   ├── core/                  Config/env-Loader + LLM-Logik
│   ├── db/                    SQLAlchemy Engine, Session, Modelle
│   ├── schemas/                Pydantic-Modelle (KI-Antwort-Schablonen)
│   ├── main.py                 CLI-Einstiegspunkt
│   ├── docker-compose.yml      Lokales PostgreSQL Setup
│   └── pyproject.toml          Poetry-Konfiguration (separat von fuel-devs Root-pyproject.toml, das ist die `fuel`-CLI)
└── frontend/                 # v4 React-Frontend (eigener Vite-Build, package.json v4.0.0)
```

### Datenfluss

1. **User Input**: Freitext an `main.py` (z.B. *"Ich aß 3 Eier mit Speck"*).
2. **NLP-Parsing (`backend/core/llm.py`)**: Text + Prompt an Gemini, `response_schema` erzwingt Pydantic-Format (`backend/schemas/food.py`).
3. **Validierung**: Pydantic stellt korrekte Typisierung sicher (Zahlen für Makros, Arrays für Zutaten).
4. **Persistierung (`backend/db/models/`)**: Typsicher als `FoodLog`/`DailyJournal` in PostgreSQL.

### "Journal-First" Datenmodell (DailyJournal)

Mit Blick auf einen späteren Übergang zu Firestore/NoSQL: `DailyJournal`
(`backend/db/models/journal.py`) speichert Zeilen mit dem Datum als Primärschlüssel.
Essen (`food_logs`) und Gewohnheiten/Supplements (`habits`) liegen als native
JSON-Arrays (JSONB). Supplements sind eine Unterform von Habits (`type: "supplement"`).

### Kalorien-Namenskonvention (`calories` vs. `kcal`)

Um Namenskonflikte mit KDE-`KCal` zu vermeiden: Backend/API nutzt durchgängig
`calories`, Frontend/UI mappt auf `kcal` für die Anzeige.

### Frontend-Auslieferung (SPA Hosting)

FastAPI dient gleichzeitig als Webserver fürs React-Frontend: `npm run build` in
`frontend/` → `frontend/dist`, FastAPI liefert `/assets` statisch aus und leitet
SPA-Routen per Catch-All auf `index.html`. Lokal läuft das auf Port `4000`. In der
aktuellen Prod-Topologie served aber noch nicht FastAPI den Haupteinstieg; dort ist
weiter v3/Node der Entry-Point und kann bei Bedarf an v4 weiterreichen.
