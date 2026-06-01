# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Philosophy: Ernährung als Religion im Vitaltraining

```
VITALTRAINING (Der eine Gott — The Ultimate Authority)
│
└─ ERNÄHRUNG (Die Religion — Nutrition Philosophy & Practice)
   │
   ├─ DU (Lernender/Coach)
   │  └─ Focus: Ausbildung, Weisheit, Ernährungsprinzipien
   │
   ├─ nutrition-agent (Der Prophet — Technical Guardian)
   │  ├─ Kernaufgabe: Deine Ausbildung unterstützen
   │  │  (Protokolle, Daily Logging, Reporting, Analysis)
   │  └─ Technische Verantwortung: fuel-dev
   │     → Erkennt: "fuel-dev braucht Feature X"
   │     → Schreibt Tickets für fuel-dev-coding-agent
   │     → Du machst dich NICHT um Technisches Gedanken
   │
   └─ fuel-dev (Der Tempel — Where It Happens)
      ├─ V1 & V2 Frontends (Altäre — Zugänge)
      ├─ Fastify API + SQLite + File-based Data
      └─ Komponenten
         ├─ Meal Catalog (individuelle JSON-Files pro Gericht)
         ├─ Supplements Catalog (catalog.json im Repo)
         ├─ Food Search (Open Food Facts Proxy)
         ├─ Micros Tracking (DACH-Referenzwerte, Wochenheatmap)
         ├─ Journal (Freitext-Notizen)
         └─ Gemini Integration (Makro- + Mikroschätzung)
```

**The Model: Clear Separation of Concerns**

| Wer | Was | Fokus |
|-----|-----|-------|
| **Du** | Lernst Ernährung, machst Protokolle, ißt bewusst | Ausbildung & Weisheit |
| **nutrition-agent** | Unterstützt deine Ausbildung, erkennt technische Lücken, schreibt Tickets | Technische Probleme lösen |
| **fuel-dev-coding-agent** | Implementiert Tickets, baut Features | Code & Funktionalität |

---

## Project Overview

**Fuel Centre** (`fuelctx`) ist ein Nutrition-Tracking-PWA für Coaches. Fastify-Backend, dateibasiertes JSON für Logs, SQLite für Ingredient-Cache und Meal-Micros, individuelle JSON-Files pro Meal im Repo.

**Ports:**
- Dev: 9000 (`server.mjs` → `src/app.mjs`)
- Vite dev: 5173
- Prod: 7000 (static)

**Data location:** `~/.aos/fuel/` (via `AOS_FUEL_DATA_DIR`)
**Catalogs:** Im Repo unter `catalogs/` (git-tracked)
**Build output:** `/opt/fuel` (via `FUEL_BUILD_DIR`)

---

## Quick Start

```bash
npm install
npm run dev        # nodemon + vite dev
npm run build      # Vite build → /opt/fuel
npm run prod       # static server port 7000
npm start          # bare server port 9000
npm run ui:dev     # Vite dev only
```

---

## Architecture

### Backend (`server.mjs` → `src/app.mjs`)

**Fastify** mit `@fastify/cors`. Routes als Plugins in `src/routes/`.
Path-Normalisierung per `preHandler`-Hook: `/c/<clientId>/nutrition/…` → `/nutrition/…`.

**Endpoints:**
```
GET  /health
GET  /nutrition/search?q=&limit=      Open Food Facts proxy
GET  /nutrition/log?date=             Tages-Mahlzeiten
POST /nutrition/log                   Mahlzeit loggen {description, catalog_id?, kcal, protein, carbs, fat}
GET  /nutrition/catalog               Alle Meals (aus catalogs/nutrition/meals/)
POST /nutrition/catalog               Meal speichern
GET  /nutrition/daily/:date           Tages-Makros + Mikros aggregiert
GET  /nutrition/weekly/:year/:week    Wochen-Mikros vs. DACH-Referenz
POST /nutrition/compose               Gericht via wger + Gemini komponieren
POST /nutrition/estimate              Gemini Makro-Schätzung (kein Save)
GET  /nutrition/journal?date=
POST /nutrition/journal
GET  /supplements/catalog
POST /supplements/catalog
GET  /supplements/log?date=
POST /supplements/log
GET  /supplements/stats?days=&anchor=
GET  /fuel/log, POST /fuel/log        legacy
```

**Datenpfade (runtime, auto-created):**
```
~/.aos/fuel/
├── nutrition/
│   ├── YYYY-MM-DD.json     tägliche Mahlzeit-Logs
│   └── nutrition.db        SQLite: ingredients + meal_micros
├── nutrition_journal/
│   └── YYYY-MM-DD.md
└── supplements/
    ├── logs/YYYY-MM-DD.json
    └── (catalog in Repo)
```

**Catalogs (repo-basiert, git-tracked):**
```
catalogs/
├── nutrition/
│   └── meals/
│       └── {id}.json       ein File pro Gericht
└── supplements/
    └── catalog.json
```

### SQLite (`nutrition.db`)

Zwei Tabellen:

**`ingredients`** — wger-Ingredient-Cache, per 100g:
- `wger_id`, `name`, `brand`, Makros (`kcal`, `protein`, `carbs`, `fat`, `fiber`, `sodium_mg`)
- Befüllt beim Compose via `/nutrition/compose`

**`meal_micros`** — Gemini-geschätztes Mikronährstoffprofil pro Mahlzeit:
- `meal_name` (Mahlzeit-Bezeichnung), alle DACH-Mikros als absolute Werte für die Portion wie gegessen
- `source`: `gemini`
- Lookup per Name (case-insensitive)

### Micros / DACH

Referenzwerte: `src/config/dach.mjs` — DGE/ÖGE Werte für D/A/CH.
Mikronährstoffe werden **nicht** täglich eingetragen — Gemini schätzt sie beim Compose für die ganze Mahlzeit.
Wochenheatmap (Mikros-Tab) aggregiert meal_micros-Werte pro Woche vs. DACH.

### Frontend

**V1 / Fuel Classic** (`public/index.html`)
- Vanilla HTML PWA, kein Build-Schritt
- SW: cache-first für Assets, network-first für API
- Kein Offline-Write-Through

**V2 / Fuel Studio** (`src/main.jsx` + Vite)
- React 18, TailwindCSS 3, TanStack Query, FullCalendar, Recharts, Zod, Zustand
- Tabs: **Dashboard · Food · Big Calendar · Journal · Supplements · Mikros · Setup**
- `Mikros`-Tab: Wochenheatmap (letzte 8 KW, Zeilen = Mikronährstoffe, Farbe = % DACH)

### Gemini Scripts (Python)

| Script | Was |
|--------|-----|
| `gemini-compose` | Gericht aus wger-Zutaten zusammensetzen + Makros |
| `gemini-estimate` | Makros für Freitextbeschreibung schätzen |
| `gemini-micros` | Mikronährstoffprofil für Mahlzeit schätzen (→ `meal_micros`) |

API-Key: `~/.env/fuel.env` (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`)

### CLI Tools

**`./fuel`** (Python/Typer)
- `fuel log melatonin`, `fuel today`, `fuel week`
- Supplement-Logs nach `~/.aos/fuel/supplements/logs/YYYY-MM-DD.json`
- Supplement-Catalog: `catalogs/supplements/catalog.json`

**`./fuel-log.zsh`** — Quick TUI für Meal-Eingabe

---

## Build & Deploy

```bash
npm run dev   # nodemon + vite, watches src/ + server.mjs
npm run build # Vite → /opt/fuel
npm run prod  # PORT=7000 HOST=0.0.0.0 FUEL_STATIC_DIR=/opt/fuel
```

**Environment Variables:**
- `PORT` (default 9000)
- `HOST` (default 127.0.0.1)
- `AOS_FUEL_DATA_DIR` (default `~/.aos/fuel`)
- `FUEL_STATIC_DIR` (default `./public`)
- `FUEL_BUILD_DIR` (default `/opt/fuel`)
- `FUEL_VITE_ORIGIN` (für Vite-Proxy in dev)

---

## Code Structure

```
fuel-dev/
├── server.mjs                    Entrypoint → src/app.mjs
├── src/
│   ├── app.mjs                   Fastify setup, Plugin-Registration
│   ├── config/
│   │   ├── constants.mjs         PORT, HOST
│   │   ├── dach.mjs              DACH Referenzwerte + getStatus()
│   │   └── paths.mjs             Alle Pfad-Konstanten
│   ├── routes/
│   │   ├── nutrition/
│   │   │   ├── index.mjs         Plugin-Wrapper für alle Nutrition-Routes
│   │   │   ├── log.mjs           GET+POST /nutrition/log
│   │   │   ├── catalog.mjs       GET+POST /nutrition/catalog
│   │   │   ├── daily.mjs         GET /nutrition/search + /nutrition/daily/:date
│   │   │   ├── weekly.mjs        GET /nutrition/weekly/:year/:week
│   │   │   ├── journal.mjs       GET+POST /nutrition/journal
│   │   │   └── compose.mjs       POST /nutrition/compose + /nutrition/estimate
│   │   ├── supplements.mjs
│   │   ├── fuel.mjs              legacy
│   │   ├── health.mjs
│   │   └── static.mjs
│   ├── services/
│   │   ├── nutrition-db.mjs      better-sqlite3: ingredients + meal_micros
│   │   ├── nutrition-catalog.mjs Meal-Catalog (individuelle Files)
│   │   ├── nutrition-micros.mjs  Wrapper: getMicrosForMeal / saveMicrosForMeal
│   │   ├── nutrition-compose.mjs gemini-compose wrapper
│   │   ├── nutrition-estimate.mjs gemini-estimate wrapper
│   │   ├── nutrition-estimate-micros.mjs gemini-micros wrapper
│   │   ├── nutrition-log.mjs
│   │   ├── nutrition-journal.mjs
│   │   ├── nutrition-search.mjs  Open Food Facts proxy
│   │   ├── supplements-catalog.mjs
│   │   ├── supplements-log.mjs
│   │   └── wger-search.mjs
│   ├── views/
│   │   ├── FoodView.jsx
│   │   └── MicrosView.jsx        Wochenheatmap DACH
│   ├── components/
│   │   ├── FoodSearch.jsx
│   │   └── NutritionHeatmap.jsx  Wochennavigation (Header)
│   ├── hooks/
│   │   └── weekLogs.js
│   ├── lib/
│   │   ├── validation.mjs
│   │   ├── file-io.mjs
│   │   └── ids.mjs
│   ├── main.jsx                  React entry, Tabs, Layout
│   └── styles.css
├── catalogs/
│   ├── nutrition/
│   │   └── meals/                {id}.json pro Gericht
│   └── supplements/
│       └── catalog.json
├── public/                       V1 vanilla PWA
├── gemini-compose                Python script
├── gemini-estimate               Python script
├── gemini-micros                 Python script
├── fuel                          Python/Typer CLI (Supplements)
├── fuel-log.zsh                  Meal-Logger TUI
└── vite.config.js
```

---

## Common Tasks

**Neues Meal in Katalog:**
```bash
# Via API (speichert als catalogs/nutrition/meals/{id}.json)
http POST :9000/nutrition/catalog item[name]="Mein Gericht" item[kcal]:=500 ...

# Via compose (wger + Gemini)
http POST :9000/nutrition/compose description="Hähnchen mit Reis" save_catalog:=true
```

**Mahlzeit loggen:**
```bash
http POST :9000/nutrition/log meal[description]="Eierspeise Freiland" \
  meal[catalog_id]=meal_eierspeise_freiland meal[kcal]:=627 meal[protein]:=44 \
  meal[carbs]:=2.2 meal[fat]:=49.4
```

**Neues Supplement:**
```bash
http POST :9000/supplements/catalog name=Magnesium dose=400 unit=mg
fuel log magnesium
```

**DACH-Referenzwerte anpassen:** `src/config/dach.mjs`

**Neuen Nutrition-Endpoint:**
1. Route in `src/routes/nutrition/` als eigenes Plugin
2. In `src/routes/nutrition/index.mjs` registrieren
3. Service in `src/services/`

---

## Nutrition Agent Skill

**Invoke with:** `/nutrition-agent`

- Protokolle generieren (7-Tage / 14-Tage)
- Daily Logging koordinieren
- Weekly Mikro-Reports lesen
- Tickets für fuel-dev schreiben wenn Feature fehlt

See `~/.claude/agents/nutrition-agent.md` for full definition.

---

## Open / Planned

- Offline write-through für POST-Queue (Vorbild: `~/core4-dev/public/offline-queue.js`)
- CLI `fuel meal` → schreibt via `/nutrition/log` (statt nur Supplements)
- Klienten-Auth für Multi-User (`/c/<id>/nutrition/…` vorbereitet)
- Export-Endpoint (`GET /nutrition/export?from=&to=` → CSV)
