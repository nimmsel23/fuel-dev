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
      ├─ Zwei Channels: **local** (Fastify, /opt/fuel) + **cloud** (Firebase PWA)
      ├─ Fastify API + SQLite + File-based Data (local channel, VITE_APP_MODE=coach)
      ├─ Firebase/Firestore (cloud channel, VITE_APP_MODE=client — fuel-vos.web.app)
      └─ Komponenten
         ├─ Meal Catalog (individuelle JSON-Files lokal / Firestore cloud)
         ├─ Supplements Catalog (catalog.yaml im Repo / Firestore cloud)
         ├─ Food Search (Open Food Facts Proxy lokal / Catalog-Suche cloud)
         ├─ Micros Tracking (DACH-Referenzwerte, Wochenheatmap)
         ├─ Journal (Freitext-Notizen)
         └─ Gemini Integration (Makro- + Mikroschätzung, nur lokal)
```

**The Model: Clear Separation of Concerns**

| Wer | Was | Fokus |
|-----|-----|-------|
| **Du** | Lernst Ernährung, machst Protokolle, ißt bewusst | Ausbildung & Weisheit |
| **nutrition-agent** | Unterstützt deine Ausbildung, erkennt technische Lücken, schreibt Tickets | Technische Probleme lösen |
| **fuel-dev-coding-agent** | Implementiert Tickets, baut Features | Code & Funktionalität |

---

## Project Overview

**Fuel Centre** (`fuelctx`) ist ein Nutrition-Tracking-PWA für Coaches — mit zwei Channels:

| Channel | Stack | Build-Mode | Deployment | Daten |
|---------|-------|------------|------------|-------|
| **local** | Fastify + SQLite + File-JSON | `VITE_APP_MODE=coach` | Port 9000 Dev / 7000 Prod (`/opt/fuel`) | `~/.aos/fuel/` |
| **cloud** | Firebase Hosting + Firestore | `VITE_APP_MODE=client` | [fuel-vos.web.app](https://fuel-vos.web.app) | Firestore (per User) |

Beide Channels teilen sich **dieselbe React-Codebase** in `src/client/` — Unterschied liegt nur im Build-Mode + Runtime-Detection via `isCloud()` in `src/client/lib/api.js`.

**Ports:**
- Dev: 9000 (`server.mjs` → `src/server/app.mjs`)
- Vite dev: 5173
- local Prod: 7000 (static, `fuel-v2.service` — Unit-Name historisch, channel ist "local")
- cloud: `https://fuel-vos.web.app`

**Data location (local):** `~/.aos/fuel/` (via `AOS_FUEL_DATA_DIR`)
**Data location (cloud):** Firestore — Collections `nutrition/{uid}/logs`, `supplements/{uid}/logs`, `users/{uid}/meta`
**Catalogs:** Im Repo unter `catalogs/` (git-tracked, local); Firestore `nutrition/{uid}/meta/catalog` (cloud).
Sync-Richtung: lokal ist Master, **aber nur solange der lokale Server läuft** — jeder lokale Katalog-Save
pusht den kompletten Dateistand per Merge (`pushNutritionCatalog`, `server/lib/firestore-admin.mjs`) nach
Firestore. Ist der lokale Server offline, ist Firestore die einzig aktive Instanz; Cloud-Änderungen aus
dieser Zeit werden beim nächsten lokalen Push jetzt gemerged statt überschrieben (Fix 2026-07-31, vorher
`merge:false`-Full-Overwrite, siehe Git-Historie).
**Build output local:** `/opt/fuel` (via `FUEL_BUILD_DIR`)
**Build output cloud:** `./dist-firebase/` → Firebase Hosting

---

## Quick Start

```bash
npm install
npm run dev          # nodemon + vite dev (Port 9000 + 5173)
npm run build:local  # Vite build → coach mode (für /opt/fuel)
npm run build:cloud  # Vite build → client mode → dist-firebase/
npm run prod         # node server.mjs auf 0.0.0.0:9000 (Desktop-Prod läuft aktuell ebenfalls über die Node-Schicht, aber auf :7000 aus /opt/fuel)
npm start            # bare server port 9000
npm run ui:dev       # Vite dev only (kein Backend)

# Deploy
npm run deploy:local   # ./deploy.sh — rsync + build + systemctl restart
npm run deploy:cloud   # build:cloud + firebase deploy --only hosting (LIVE auf fuel-vos.web.app)
npm run deploy:preview # build:cloud + 24h-Preview-Channel + Telegram-Link (scripts/deploy-preview.mjs)
./deploy.sh            # direkt (= deploy:local)

# Sync
npm run sync:push    # lokale Katalog-Daten → Firestore
npm run sync:pull    # Firestore → lokale Dateien
npm run sync:watch   # firestore-sync.mjs im Watch-Modus
```

**Auto-Deploy via pre-push Hook (seit 2026-07-30 aktiv):** `.githooks/pre-push` (`core.hooksPath=.githooks`) prüft bei jedem Push auf `master`, ob relevante Dateien (`src/`, `public/`, `index.html`, `vite.config*`, `package.json`, `firebase.json`, `firestore.rules`) im Diff sind — wenn ja, läuft automatisch `npm run firebase` (= `build:cloud` + `deploy:firebase`) **vor** dem Push. Fehlschlag bricht den Push ab (kein halb-deployter Stand). Umgehen mit `git push --no-verify`, falls explizit gewünscht. Das früher dokumentierte "kein Auto-Deploy mehr" (Entfernung eines alten `post-commit`-Hooks) bezog sich auf einen anderen, älteren Mechanismus — dieser pre-push-Hook ist der aktuell gewollte Deploy-Flow.

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
    └── catalog.yaml
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

**Classic** (`public/index.html`) — Legacy, weiter mitserved
- Vanilla HTML PWA, kein Build-Schritt
- SW: cache-first für Assets, network-first für API
- Kein Offline-Write-Through

**local channel** (`src/client/main.jsx` + Vite, `VITE_APP_MODE=coach`)
- React 18, TailwindCSS 3, TanStack Query, FullCalendar, Recharts, Zod, Zustand
- Tabs: **Dashboard · Food · Big Calendar · Journal · Supplements · Mikros · Setup**
- `Mikros`-Tab: Wochenheatmap (letzte 8 KW, Zeilen = Mikronährstoffe, Farbe = % DACH)
- Ruft direkt lokales Fastify-Backend an (Port 9000 dev / 7000 prod)

**cloud channel** (`src/client/main.jsx` + Vite, `VITE_APP_MODE=client`)
- Gleiche React-Codebase wie local channel — Deployment-Modus wird per `isCloud()` erkannt
- `src/client/lib/api.js` — Cloud-Aware-Abstraction: leitet alle Reads/Writes je nach Hostname zu Fastify-Backend oder Firestore-SDK
- `src/client/lib/db.firestore.js` — Firestore Data Layer (Multi-User, per UID)
- `src/client/lib/firebase.js` — Firebase Init + Auth (Google Sign-In)
- Firestore Collections: `nutrition/{uid}/logs`, `nutrition/{uid}/meta/catalog`, `nutrition/{uid}/journal`, `supplements/{uid}/logs`, `supplements/{uid}/meta/catalog`, `users/{uid}/meta/settings`
- AI Logger (lokales Gemini-Backend) → nur im local channel sichtbar (kein Backend in cloud)
- `dist-firebase/` → Firebase Hosting (fuel-vos.web.app)

### Gemini Scripts (Python)

| Script | Was |
|--------|-----|
| `gemini-compose` | Gericht aus wger-Zutaten zusammensetzen + Makros |
| `gemini-estimate` | Makros für Freitextbeschreibung schätzen |
| `gemini-micros` | Mikronährstoffprofil für Mahlzeit schätzen (→ `meal_micros`) |

API-Key: `~/.env/fuel.env` (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`)

### Nährwert-Schätzung: Haiku-CLI zuerst, Gemini als Fallback (seit 2026-07-23)

`fuel/gemini.py:estimate_nutrition()` ruft nicht mehr direkt Gemini, sondern zuerst
`fuel/claude_cli.py:call_claude()` — ein Subprocess-Call auf die lokal installierte
Claude Code CLI (`claude -p <prompt> --model claude-haiku-4-5-20251001
--allowedTools WebSearch`, `stdin=DEVNULL`). Der Prompt weist Haiku bei erkannter
Marke an, per WebSearch die offizielle Herstellertabelle zu suchen, statt zu
schätzen. Nur wenn die CLI fehlt (`shutil.which("claude")` → None), fehlschlägt
oder kein valides JSON liefert, fällt der Code auf den bisherigen
Multi-Key-Gemini-Pfad (`call_gemini()`) zurück — Gemini bleibt vollständiger
Fallback, kein Feature-Verlust.

**Warum `--allowedTools WebSearch` zwingend ist:** ohne dieses Flag nutzt Haiku im
`-p`-Headless-Modus kein WebSearch (Tool-Permission-Gate greift auch non-interaktiv).
`--permission-mode bypassPermissions` funktioniert technisch, wird aber vom
Claude-Code-Auto-Mode-Classifier als riskant geblockt — nicht nötig, das gezielte
`--allowedTools WebSearch` reicht für diesen Use-Case.

### Katalog-Verifikation: `fuel-catalog-verify` (wöchentlich, optional)

`fuel/catalog_verify.py` (`python3 -m fuel.catalog_verify --limit N`, Default
`N=20`) scannt `catalogs/nutrition/meals/*.yaml` nach `source: gemini`
(unverifiziert) und lässt Haiku+WebSearch pro Eintrag nach der offiziellen
Herstellertabelle suchen. Bei Treffer wird die YAML-Datei direkt korrigiert
(`kcal`/`protein`/`carbs`/`fat`/`yield_g` neu berechnet, `source: manual`, `notes`
mit Quelle). Kein Treffer → Eintrag bleibt unverändert (kein blindes Überschreiben).
`source: manual`-Einträge gelten als bereits verifiziert und werden nie erneut
angefasst.

Regel seit 2026-07-23 (User-Vorgabe): Katalog-Einträge sollen, wann immer eine
offizielle Quelle auffindbar ist, auf diese umgestellt werden statt auf einer
Gemini-/Haiku-Schätzung zu verbleiben.

**systemd — aktiv seit 2026-07-23:** Units liegen unter
`deploy/systemd/fuel-catalog-verify.{service,timer}` (Symlinks in
`~/.config/systemd/user/`), Timer läuft wöchentlich Montag 04:00
(`Persistent=true` — holt verpasste Läufe beim nächsten Boot nach). Status prüfen:
```bash
systemctl --user list-timers fuel-catalog-verify.timer
journalctl --user -u fuel-catalog-verify.service -n 50
```
Deaktivieren falls nötig: `systemctl --user disable --now fuel-catalog-verify.timer`.

### CLI Tools

**`./fuel`** (Python/Typer)
- `fuel log melatonin`, `fuel today`, `fuel week`
- Supplement-Logs nach `~/.aos/fuel/supplements/logs/YYYY-MM-DD.json`
- Supplement-Catalog: `catalogs/supplements/catalog.yaml`

**`./fuel-log.zsh`** — Quick TUI für Meal-Eingabe

---

## Build & Deploy

### local channel (aktueller Desktop-Entry-Point: v3/Node)
```bash
npm run dev          # nodemon + vite, watches src/ + server.mjs
npm run build:local  # Vite → ./opt-fuel target (VITE_APP_MODE=coach)
npm run prod         # PORT=7000 HOST=0.0.0.0 FUEL_STATIC_DIR=/opt/fuel
npm run deploy:local # = ./deploy.sh — versioned backup → rsync → build → systemctl restart
./deploy.sh          # Bash deploy script (siehe unten)
fuelctl local deploy # Python-Wrapper, ruft deploy.sh
```

**`deploy.sh`** macht aktuell zweistufig: `staging` synced `~/fuel-dev` nach
`~/.local/fuel`; `prod` synced von dort nach `/opt/fuel` und `/opt/fuel-python`.
Der laufende systemd-Entry-Point ist dabei derzeit noch `fuel.service` aus
`/opt/fuel`. Das Python-Backend wird mitdeployt, ist aber noch nicht der aktive
Prod-Service.

**Environment Variables (local):**
- `PORT` (default 9000)
- `HOST` (default 127.0.0.1)
- `AOS_FUEL_DATA_DIR` (default `~/.aos/fuel`)
- `FUEL_STATIC_DIR` (default `./public`)
- `FUEL_BUILD_DIR` (default `/opt/fuel`)
- `FUEL_VITE_ORIGIN` (für Vite-Proxy in dev)

### cloud channel (Firebase PWA)
```bash
npm run build:cloud  # VITE_APP_MODE=client → dist-firebase/
npm run deploy:cloud # build:cloud + firebase deploy --only hosting
npm run sync:push    # Lokale Katalog-JSONs → Firestore (scripts/firestore-sync.mjs)
npm run sync:pull    # Firestore → lokale Dateien
npm run deploy:preview # 24h-Preview-Channel + Telegram-Link
```

**Firebase Config:** `src/client/lib/firebase.config.js` — Project: `fitness-aos` (Hosting-Site: `fuel-vos` → fuel-vos.web.app). Das frühere Projekt `fuel-aos` ist abgelöst — alle VitalOS-Apps deployen ins gemeinsame Projekt `fitness-aos`, unterschieden per Hosting-Site.
**Auto-Deploy:** `.githooks/pre-push` deployt automatisch bei Push auf `master`, wenn relevante Dateien im Diff sind (Details siehe oben) — daneben bleiben `deploy:cloud` / `deploy:preview` für manuelle/Preview-Deploys.

**24h-Preview (`deploy:preview`):** `scripts/deploy-preview.mjs` deployt einen Preview-Channel (24h gültig) und schickt den Link per Telegram (`@aos_fitness_bot`, Creds aus `~/.env/fitness.env`). Läuft bewusst **lokal statt als GitHub Action**: die Crossover-Aliase in `vite.config.cjs` (`@db`/`@utils` → `~/fitness-dev`, `@habits` → `~/habits-dev`) zeigen absolut auf Nachbar-Repos, die auf einem CI-Runner nicht existieren. Deaktivierte CI-Workflows liegen in `.github/workflows.disabled/`.

### Branch-Modell (dev / master)

`~/fuel-dev` und `~/vitalos/fuel-dev` sind **dasselbe Git-Repo** (geteilte Git-DB unter `~/vitalos/.git/modules/fuel-dev`):

| Checkout | Branch | Rolle |
|---|---|---|
| `~/fuel-dev` (home, Worktree) | `dev` | Entwicklung — hier wird committet |
| `~/vitalos/fuel-dev` (Submodule des vitalos-Superprojekts) | `master` | Produktions-Stand |

Flow: auf `dev` entwickeln → `npm run deploy:preview` (24h-Link testen) → wenn OK, Merge `dev` → `master` → `npm run deploy:cloud`. Beide Branches liegen auf GitHub (`dev` seit 2026-07-05 gepusht — davor existierte er nur lokal, daher der Eindruck „kein dev-Zweig").

---

## Code Structure

```
fuel-dev/
├── server.mjs                    Entrypoint → src/server/app.mjs
├── src/
│   ├── client/                   ─── Frontend (React, Vite) ───────────────────
│   │   ├── main.jsx              React entry, Tabs, Layout, Auth
│   │   ├── store.js              Zustand: activeTab, activeDate
│   │   ├── styles.css
│   │   ├── views/
│   │   │   ├── DashboardView.jsx  Makro-Summary, Trend-Charts
│   │   │   ├── FoodView.jsx       Logging-Form, Food-Search, Katalog, Rezept-Builder
│   │   │   ├── MicrosView.jsx     Wochenheatmap DACH
│   │   │   ├── CalendarView.jsx   FullCalendar Monatsansicht
│   │   │   ├── JournalView.jsx    Freitext-Notizen
│   │   │   ├── SupplementsView.jsx
│   │   │   └── SettingsView.jsx
│   │   ├── components/
│   │   │   ├── FoodSearch.jsx     Open Food Facts / Catalog-Suche
│   │   │   ├── NutritionHeatmap.jsx Wochennavigation (Header)
│   │   │   ├── GeminiCatalogModal.jsx
│   │   │   └── ui.jsx             Shared MealRow etc.
│   │   ├── hooks/
│   │   │   ├── useNutrition.js    useNutritionData / useMacroTrend / useJournal
│   │   │   ├── useSupplements.js
│   │   │   └── weekLogs.js
│   │   └── lib/
│   │       ├── api.js             ⭐ Cloud-Aware Abstraction (lokal→Fastify / cloud→Firestore)
│   │       ├── firebase.js        Firebase Init + Auth
│   │       ├── firebase.config.js Firebase Project: fitness-aos (Site: fuel-vos)
│   │       └── db.firestore.js    Firestore Data Layer (Multi-User, per UID)
│   ├── server/                   ─── Backend (Fastify, Node) ─────────────────
│   │   ├── app.mjs               Fastify setup, Plugin-Registration
│   │   ├── config/
│   │   │   └── paths.mjs         Alle Server-Pfad-Konstanten
│   │   ├── routes/
│   │   │   ├── nutrition/
│   │   │   │   ├── index.mjs     Plugin-Wrapper für alle Nutrition-Routes
│   │   │   │   ├── log.mjs       GET+POST+PATCH /nutrition/log
│   │   │   │   ├── catalog.mjs   GET+POST /nutrition/catalog
│   │   │   │   ├── daily.mjs     GET /nutrition/search + /nutrition/daily/:date
│   │   │   │   ├── weekly.mjs    GET /nutrition/weekly/:year/:week
│   │   │   │   ├── journal.mjs   GET+POST /nutrition/journal
│   │   │   │   ├── compose.mjs   POST /nutrition/compose + /nutrition/estimate
│   │   │   │   ├── estimate.mjs  POST /nutrition/estimate (standalone)
│   │   │   │   └── ai-log.mjs    POST /nutrition/ai-log (Gemini dispatcher)
│   │   │   ├── supplements.mjs
│   │   │   ├── supplement-estimate.mjs
│   │   │   ├── fuel.mjs          legacy
│   │   │   ├── health.mjs
│   │   │   └── static.mjs
│   │   ├── services/
│   │   │   ├── nutrition-db.mjs  better-sqlite3: ingredients + meal_micros
│   │   │   ├── nutrition-catalog.mjs Meal-Catalog (individuelle Files)
│   │   │   ├── nutrition-micros.mjs  getMicrosForMeal / saveMicrosForMeal
│   │   │   ├── nutrition-compose.mjs gemini-compose wrapper
│   │   │   ├── nutrition-estimate.mjs gemini-estimate wrapper
│   │   │   ├── nutrition-estimate-micros.mjs gemini-micros wrapper
│   │   │   ├── nutrition-log.mjs
│   │   │   ├── nutrition-journal.mjs
│   │   │   ├── nutrition-search.mjs  Open Food Facts proxy
│   │   │   ├── gemini.mjs        Gemini-SDK Wrapper
│   │   │   ├── supplements-catalog.mjs
│   │   │   ├── supplements-log.mjs
│   │   │   └── wger-search.mjs
│   │   └── lib/
│   │       └── file-io.mjs
│   └── shared/                  ─── Geteilter Code (client + server) ──────────
│       ├── config/
│       │   ├── constants.mjs    PORT, HOST
│       │   └── dach.mjs         DACH Referenzwerte + getStatus()
│       └── utils/
│           ├── ids.mjs
│           ├── validation.mjs
│           └── utils.js
├── catalogs/
│   ├── nutrition/
│   │   └── meals/               {id}.json pro Gericht (lokal git-tracked)
│   └── supplements/
│       └── catalog.yaml
├── public/                      Classic vanilla PWA (legacy)
├── bin/
│   └── fuel-food-search         CLI food search
├── gemini-compose               Python script (Makro-Schätzung via wger)
├── gemini-estimate              Python script (freie Beschreibung → Makros)
├── gemini-micros                Python script (Mahlzeit → Mikronährstoffprofil)
├── fuel                         Python/Typer CLI (Supplements)
├── dist-firebase/               cloud channel Build → Firebase Hosting (git-ignored)
├── deploy.sh                    local channel deploy → /opt/fuel
├── scripts/
│   ├── dev-runner.mjs           Dev-Runner (nodemon wrapper)
│   └── firestore-sync.mjs       Lokale Kataloge ↔ Firestore sync
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

- **Tab-Modularisierung:** `main.jsx` ist zu groß — Tabs als eigene Lazy-geladene Module, Tab-Config als Array of `{ key, label, icon, component }`
- **Chunk-Splitting:** Build-Warning "Some chunks are larger than 500 kB" — dynamische Imports für FullCalendar, Recharts, etc.
- **Offline write-through (cloud):** POST-Queue via IndexedDB (Vorbild: `~/core4-dev/public/offline-queue.js`) für Firebase-Mode
- **systemd-Unit umbenennen:** `fuel-v2.service` → `fuel-local.service` (sudo-Op, bisher nicht angefasst — Unit-Name historisch, funktional egal)
- **`v2/` archiviert:** liegt in `~/.archive/fuel-dev-v2-2026-06-17/` für ggf. Referenz
- **CLI `fuel meal`:** schreibt via `/nutrition/log` (statt nur Supplements)
- **Export-Endpoint:** `GET /nutrition/export?from=&to=` → CSV (lokal)
- **Firestore-Sicherheitsregeln:** Production-ready Rules für `nutrition/{uid}` und `supplements/{uid}`
- **Klienten-Auth Multi-User (lokal):** `/c/<id>/nutrition/…` Route bereits vorbereitet

---

## Architektur-Richtung: fuel_agent/ (Stand 2026-07-02)

### Dual-Channel = zwei verschiedene Apps, eine gemeinsame UI

**Coach (local)** und **Client (cloud)** sind konzeptuell zwei getrennte Produkte:

| | Coach (local) | Client (cloud) |
|---|---|---|
| User | Du (Coach, Desktop) | Klienten (Mobile PWA) |
| Backend | Python `fuel_agent/` → Fastify (→ ablösen) | Firebase/Firestore |
| Data | `~/.aos/fuel/` (SQLite + JSON) | Firestore Collections |
| AI | Gemini (lokal, Python) | — |
| Auth | keins (single-user) | Google Sign-In |
| Build | `VITE_APP_MODE=coach` → `@api` → `api.local.js` | `VITE_APP_MODE=client` → `@api` → `api.cloud.js` |

Gemeinsam ist nur `src/client/` UI (Views, Hooks, Components) — kein Backend-Code, kein Firebase-SDK im Coach-Build, kein Fastify-Code im Cloud-Build.

### fuel_cli/ → fuel_agent/ (Referenz: fitness-dev)

`fitness-dev` hat denselben Weg bereits abgeschlossen:
- `fitness_cli/` + standalone Scripts → `fitness_agent/` Python-Package
- Node.js `server.mjs` → `fitness_agent/server.py` (FastAPI + static serving)
- Catalog-Pipeline, Gemini, wger — alles in `fitness_agent/`

**fuel-dev ist auf demselben Pfad, aber noch nicht am Ziel:**

| Was existiert | Ziel |
|---|---|
| `fuel_cli/` (catalog, gemini, compose, log, http) | → `fuel_agent/` umbenennen |
| `bin/gemini-*` Standalone-Scripts | → in `fuel_agent/gemini.py` integrieren |
| Fastify `server.mjs` | → organisch schrumpfen während Python wächst |
| `fuel_routes.yaml` | bleibt als SSOT für Endpoints |

**Prinzip: kein Doppel-Code.** Jede Catalog-Logik, jede Gemini-Integration, jede Datei-Op gehört einmal in `fuel_agent/`. Der Fastify-Server proxied oder ruft `fuel_agent/` auf — er dupliziert keine Logik.

### @api Alias-Split (bereits umgesetzt)

```
src/client/lib/
├── api.local.js   ← Coach: reines fetch() zu Fastify, kein Firebase-Import
└── api.cloud.js   ← Client: reines Firestore, kein Fastify-Import
```

`vite.config.js` + `vite.config.cjs` wählen per `appMode` welche Datei gebündelt wird. Firebase-SDK kommt nie in den Coach-Build.

---

## Dispatcher

Jedes neue Skript/Tool in diesem Repo gehört als Option in den zentralen Dispatcher — nicht als loses Standalone-Script.
Bei Bash vs. Python: Python bevorzugen. Deps: `typer` + `loguru` + `gum`-Fallback für TUI.
Referenz-Implementierung: `~/aos-dev/bin/bridge-devctl menu`

| Dispatcher | Typ | Funktion |
|---|---|---|
| `bin/fuel` | python3 | **Domain CLI** — direkter File-Zugriff auf `~/.aos/fuel/`, HTTP-Fallback via `fuel_cli/http.py` |
| `bin/fuel-devctl` | python3 | **Stack-Controller** (start/stop/status/logs/build) — Node-Server `:9000` |
| `bin/fuelctl` | python3 | **Universal-Controller** (dev/local/sync/catalog) — wraps fuel-devctl |

`bin/fuel` = Day-to-day Logging + Abfragen — liest direkt aus `~/.aos/fuel/nutrition/` und `~/.aos/fuel/supplements/logs/`. Kein laufender Server nötig.
`bin/fuel-devctl` = reiner Service-Controller. Neues Server-Tool → hierher.
`bin/fuelctl` = höherer Wrapper (deploy, sync, catalog-server).

### HTTP-Fallback-Modul

`fuel_cli/http.py` — sauberes Python-Modul (`import fuel_cli.http as _http`).
Wird von `bin/fuel` via `_try_http()` aufgerufen wenn direkte File-Lese fehlschlägt.
Ziel: Fastify-Server `:9000` (env: `PORT`).

```python
from fuel_cli import http as _http
_http.nutrition_log(date)       # GET /nutrition/log?date=YYYY-MM-DD
_http.supplements_log(date)     # GET /supplements/log?date=YYYY-MM-DD
_http.daily(date)               # GET /nutrition/daily/<date>
```
