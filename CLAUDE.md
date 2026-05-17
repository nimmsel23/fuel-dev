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
      ├─ APIs & File-based Data (Das Herz des Tempels)
      └─ Komponenten (mehrere Features)
         ├─ Meal Catalog (Wiederverwendbare Mahlzeiten)
         ├─ Supplements Catalog (Supplement-Definitionen)
         ├─ Food Search (Open Food Facts Proxy)
         ├─ Journal (Notizen)
         └─ ... weitere Features bei Bedarf
```

**The Model: Clear Separation of Concerns**

| Wer | Was | Fokus |
|-----|-----|-------|
| **Du** | Lernst Ernährung, machst Protokolle, ißt bewusst | Ausbildung & Weisheit |
| **nutrition-agent** | Unterstützt deine Ausbildung, erkennt technische Lücken, schreibt Tickets | Technische Probleme lösen |
| **fuel-dev-coding-agent** | Implementiert Tickets, baut Features | Code & Funktionalität |

**You focus on learning. The agent focuses on the technical headaches. The coder focuses on implementation.**

**The Ornamentation:**
- Deine Ernährungswissenschaftliche Erkenntnisse → informieren fuel-dev Features
- Deine Makro-Prinzipien → formen die Katalog-Struktur
- Deine Lern-Materialien → bereichern die Dokumentation
- The teachings beautify the stone.

**For Claude:** Your mission in this repo: Support the nutrition-agent's work. When the agent discovers fuel-dev needs something—listen. Write the ticket. Let the coder handle implementation. **The agent is the prophet; you are the scribe of the prophet.**

---

## Project Overview

**Fuel Centre** (`fuelctx`) is a nutrition tracking PWA designed for coaches. It provides dual-layer frontend access (V1 classic vanilla HTML, V2 modern React), a plain Node.js backend, file-based JSON storage, and CLI tools for supplement logging.

**Ports:**
- Dev: 9000 (server.mjs)
- Vite dev: 5173
- Prod: 7000 (static)

**Data location:** Configurable, default `~/.aos/fuel/`
**Build output:** Configurable, default `/opt/fuel`

---

## Quick Start

```bash
# Install dependencies
npm install

# Development: nodemon watches server + vite dev
npm run dev

# Production server (static serving from /opt/fuel)
npm run prod

# Build frontend to /opt/fuel
npm run build

# Start bare server (port 9000)
npm start

# Frontend dev only (Vite)
npm run ui:dev

# Quick meal/supplement logging
./fuel-log.zsh
```

---

## Architecture

### Backend (`server.mjs`)

Plain Node.js `http` module, no framework. Routes via normalized path matching on:

**Core Endpoints:**
- `GET /health` — server status
- `GET /nutrition/search?q=&limit=` — Open Food Facts proxy (https, no external deps)
- `GET /nutrition/log?date=YYYY-MM-DD` — fetch day's meals
- `POST /nutrition/log` — log meal (type, description, kcal, protein, carbs, fat, water_ml)
- `GET /nutrition/catalog` — saved meals/dishes
- `POST /nutrition/catalog` — save reusable meal
- `GET /nutrition/journal?date=` — free-form journal entry
- `POST /nutrition/journal` — write journal
- `GET /supplements/catalog` — supplement definitions
- `POST /supplements/catalog` — define new supplement
- `GET /supplements/log?date=` — day's intakes
- `POST /supplements/log` — log intake or delete
- `GET /supplements/stats?days=30&anchor=YYYY-MM-DD` — streak/trend data
- `GET /fuel/log`, `POST /fuel/log` — legacy fuel domain

**Data Directories (auto-created):**
```
~/.aos/fuel/
├── fuel/ (legacy logs)
├── nutrition/
│   ├── YYYY-MM-DD.json (daily meals)
│   └── catalog.json (saved dishes)
├── nutrition_journal/ (free-form entries)
└── supplements/
    ├── catalog.json (supplement defs)
    └── logs/
        └── YYYY-MM-DD.json (intakes)
```

**Routing Normalization:**
- `/c/<clientId>/nutrition/…` → `/nutrition/…` (client-based routing, auth layer TBD)
- `/<prefix>/nutrition/…` → `/nutrition/…`

### Frontend

**V1 / Fuel Classic** (`public/index.html`)
- Vanilla HTML PWA, no build step
- Service Worker (`public/sw.js`): cache-first for assets, network-first + fallback for API
- No offline write-through (failed POSTs not queued)
- Stable, zero-dependency fallback

**V2 / Fuel Studio** (`src/main.jsx` + Vite)
- React 18, TailwindCSS 3, React Query, FullCalendar, Recharts, React Hook Form, Zod, Zustand
- Tabs: Dashboard · Big Calendar · Journal · Supplements · Settings
- State: Zustand store for activeTab/activeDate
- Data fetching: React Query (TanStack)
- Validation: Zod schemas (meal, journal, water, supplement)

**Food Search** (V2 Journal tab)
- Debounced 350ms input → `GET /nutrition/search`
- Dropdown shows name/brand + macros per 100g
- Portion sizes: S 100g / M 200g / L 300g / XL 450g
- Auto-fills kcal/protein/carbs/fat
- Optional: save as reusable catalog item (with component tracking)

### CLI Tools

**`./fuel`** (Python/Typer)
- Supplement logging: `fuel log melatonin --yesterday`, `fuel log melatonin 2 --time morning`
- Status: `fuel today`, `fuel list`, `fuel week` (CSV export)
- Reads catalog from `~/.aos/fuel/supplements/catalog.json`
- Logs to `~/.aos/fuel/supplements/logs/YYYY-MM-DD.json`

**`./fuel-log.zsh`**
- Quick TUI for meal entry
- Wrapper around server API

---

## Build & Deploy

**Development:**
```bash
npm run dev  # nodemon + vite, watches src + server.mjs + config files
```

**Production:**
```bash
# 1. Build static assets
npm run build

# 2. Start static server on port 7000
npm run prod  # sets PORT=7000 HOST=0.0.0.0 FUEL_STATIC_DIR=/opt/fuel

# Or serve from custom location
FUEL_STATIC_DIR=/path/to/build npm run start
```

**Environment Variables:**
- `PORT` (default 9000)
- `HOST` (default 127.0.0.1)
- `AOS_FUEL_DATA_DIR` (default `~/.aos/fuel`)
- `FUEL_STATIC_DIR` (default `./public`)
- `FUEL_BUILD_DIR` (default `/opt/fuel`)
- `FUEL_VITE_ORIGIN` (for local vite proxy in dev)

---

## Code Structure

```
fuel-dev/
├── server.mjs                  # Node backend, all API routing
├── src/
│   ├── main.jsx               # React entry, tabs, layout, QueryClient
│   ├── styles.css             # TailwindCSS + custom
│   ├── components/
│   │   ├── FoodSearch.jsx      # Debounced search + dropdown
│   │   └── NutritionHeatmap.jsx
│   ├── views/
│   │   └── FoodView.jsx
│   └── hooks/
│       └── weekLogs.js
├── public/
│   ├── index.html             # V1 classic, stable vanilla PWA
│   ├── manifest.json          # PWA install manifest
│   ├── sw.js                  # Service Worker (cache-first assets)
│   └── icons/
├── scripts/
│   └── dev-runner.mjs         # nodemon wrapper
├── vite.config.js             # Vite + PWA plugin config
├── tailwind.config.cjs
├── postcss.config.cjs
├── index.html                 # V2 entry for Vite build
├── data/                      # Local JSON storage (git-ignored)
├── package.json
├── ARCHITECTURE.md            # Full technical spec
├── NUTRITION.md               # CLI backend & training context
└── README.md                  # User guide
```

---

## Key Patterns

**Fetching:**
```js
// Zustand store for active tab/date
const { activeTab, activeDate } = useApp();

// React Query for API data
const { data, isLoading } = useQuery({
  queryKey: ['nutrition-log', date],
  queryFn: () => fetchJson(`/nutrition/log?date=${date}`)
});

// Mutations for POSTs
const mutation = useMutation({
  mutationFn: (body) => postJson('/nutrition/log', body),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition-log'] })
});
```

**Validation:**
```js
const mealSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1, "Bitte eine Mahlzeit eintragen."),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(mealSchema),
  defaultValues: { date: format(new Date(), 'yyyy-MM-dd') }
});
```

**File-based data:**
Server reads/writes JSON directly from `~/.aos/fuel/`. No database. Directories auto-created.

---

## Nutrition Agent Skill

**Invoke with:** `/nutrition-agent`

The nutrition-agent is a specialized skill for managing Vitaltrainer-Ausbildung nutrition projects:

- **Pflichtaufgaben:** Generate 7-day (Ernährungstrainer B) or 14-day (Fitnesstrainer) protocols
- **Daily Logging:** wger-food (OFF + wger-API hybrid) or fuel-log (quick CLI)
- **Analysis & Reporting:** Weekly summaries, macro breakdowns, trend analysis
- **wger-Docker:** Local nutrition database integration
- **Export:** PDF generation for assignment submissions

**Trigger the agent for:**
```
"Generate my 7-day Ernährungstrainer protocol"
"Log my breakfast — should I use wger-food or fuel-log?"
"Show me nutrition summary for this week"
"Export my protocol as PDF"
```

See `~/.claude/agents/nutrition-agent.md` for full agent definition.

---

## Testing & Quality

- No test suite currently in place
- Manual API testing via `httpie` or curl
- Zod schemas handle input validation
- Component-level dev via Vite HMR

---

## Common Tasks

**Add a new nutrition endpoint:**
1. Add Zod schema in `src/main.jsx`
2. Add route in `server.mjs` (normalize path, validate body, write to `NUTRITION_DIR`)
3. Add React Query hook/mutation in component
4. Form validation via Zod resolver

**Add a new supplement:**
1. Edit `~/.aos/fuel/supplements/catalog.json` (or API POST to `/supplements/catalog`)
2. CLI `fuel log <name>` auto-detects it

**Change build output directory:**
- Set `FUEL_BUILD_DIR=/path` env var, or edit `vite.config.js` `outDir`

**Vite dev server integration:**
- Set `FUEL_VITE_ORIGIN=http://localhost:5173` if needed
- Server proxies Vite routes via `shouldProxyToVite()`

---

## Planned / Open

- Offline write-through for POST queue
- CLI ↔ API schema alignment (`wger-food --api` writes to `/nutrition/log`)
- wger local as primary nutrition source (via docker, currently not synced)
- Client auth layer for multi-user support
- Export/backup endpoints
