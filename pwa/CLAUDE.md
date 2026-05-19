# Fuel PWA — Firebase Build

Eigenständige Firebase PWA für Nutrition + Supplement Tracking.
Kein lokaler Server, keine Abhängigkeit zu `fuel-dev` zur Laufzeit.

---

## Architektur

```
pwa/
├── src/
│   ├── App.jsx                    Tab-Layout (Heute · Food · Supps · Journal)
│   ├── firebase.config.js         Firebase-Credentials (in .gitignore, nie committen)
│   ├── firebase.js                Firebase-App + Firestore-Instanz
│   ├── db.js                      Firestore Data Layer — einzige Datenquelle
│   ├── screens/
│   │   ├── TodayScreen.jsx        Tages-Übersicht + Makros
│   │   ├── FoodLoggerScreen.jsx   Mahlzeit loggen
│   │   ├── SupplementsScreen.jsx  Supplement-Tracking
│   │   └── JournalScreen.jsx      Freitext-Journal
│   ├── components/
│   │   └── NutritionHeatmap.jsx   Wochennavigation (Header)
│   └── hooks/
│       └── useOnlineStatus.js     Online/Offline-Status
├── public/
│   ├── manifest.json              PWA-Manifest
│   └── sw.js                      Service Worker (Vite-PWA generiert)
├── firebase.json                  Hosting-Config (public: dist, SPA-Rewrite)
├── .firebaserc                    Firebase-Projekt-ID
└── vite.config.js                 Vite + VitePWA Plugin
```

---

## Datenstruktur (Firestore)

```
nutrition/{uid}/logs/{date}        → { date, meals:[], water_ml:0 }
nutrition/{uid}/journal/{date}     → { date, content:"" }
supplements/{uid}/meta/catalog     → { items:[] }
supplements/{uid}/logs/{date}      → { date, intakes:[] }
```

`uid = "default"` — Single-User, kein Auth erforderlich.

---

## Data Layer (`src/db.js`)

Alle Datenoperationen gehen ausschließlich über `db.js` — nie direkt fetch() auf API-Endpunkte aus den Screens. `db.js` ist die einzige Stelle die Firestore kennt.

| Funktion | Was |
|----------|-----|
| `getNutritionLog(date)` | Tages-Log laden |
| `addMeal(date, meal)` | Mahlzeit hinzufügen |
| `deleteMeal(date, meal)` | Mahlzeit entfernen |
| `setWater(date, ml)` | Wassermenge setzen |
| `getJournal(date)` | Journal-Eintrag laden |
| `saveJournal(date, content)` | Journal speichern |
| `getSupplementsCatalog()` | Supplement-Catalog (mit Seed) |
| `getSupplementLog(date)` | Tages-Supplement-Log |
| `addSupplementIntake(date, intake)` | Supplement geloggt |
| `removeSupplementIntake(date, intake)` | Supplement-Eintrag löschen |
| `searchFood(q, limit)` | Open Food Facts Suche |

---

## Meal Catalog

Der Meal-Catalog (`catalogs/nutrition/meals/` aus fuel-dev) wird als **statisches JSON** in den Build eingebundelt — kein Firestore, kein API-Call.

```js
// In db.js oder separatem catalog.js
import catalog from "../../catalogs/nutrition/meals/index.json";
```

Alternativ: relative Imports der einzelnen JSON-Files (Vite unterstützt das).

---

## Supplement Catalog

Supplement-Catalog lebt in Firestore (`supplements/default/meta/catalog`).
Beim ersten Aufruf wird `SUPPLEMENT_SEED` aus `db.js` geschrieben.
Der Seed in `db.js` muss mit `catalogs/supplements/catalog.json` aus fuel-dev synchron gehalten werden.

---

## Food Search

`searchFood()` in `db.js` ruft aktuell `/nutrition/search` auf — das ist der lokale Fastify-Server. Für den Firebase-Build gibt es zwei Optionen:

1. **Open Food Facts direkt** — `https://world.openfoodfacts.org/cgi/search.pl` im Browser aufrufbar (kein CORS-Problem bei manchen Endpoints)
2. **Firebase Function** — kleiner Proxy der den OFF-Request macht

Vorerst: direkter OFF-Aufruf, Function als Phase 2.

---

## Mikronährstoffe (Phase 2)

Gemini-Schätzung via Firebase Functions:
```
Firebase Function: estimateMicros(mealDescription)
  → Gemini API
  → speichert in Firestore: nutrition/{uid}/micros/{mealName}
```

Wochenheatmap liest dann aus `nutrition/{uid}/micros/`.
DACH-Referenzwerte als statisches Import aus `src/config/dach.js` (aus fuel-dev übernehmen).

---

## Setup

```bash
# Firebase CLI
npm install -g firebase-tools
firebase login
firebase use --add   # Projekt auswählen oder neu anlegen

# firebase.config.js füllen (Firebase Console → Projekteinstellungen → Web-App)
cp src/firebase.config.example.js src/firebase.config.js
# Credentials eintragen

# Dev
npm run dev          # Vite dev server :5173 (Firestore live)

# Deploy
npm run deploy       # vite build + firebase deploy --only hosting
```

---

## Wichtige Regeln

- `firebase.config.js` niemals committen (in `.gitignore`)
- Alle Daten über `db.js` — nie Firestore direkt in Screens importieren
- Meal-Catalog als statischer Build-Asset, nicht in Firestore
- `uid = "default"` bis Firebase Auth explizit eingebaut wird
- Kein Vite-Proxy auf localhost — die PWA muss ohne lokalen Server funktionieren
- Offline-First: Firestore SDK cached automatisch, SW cached Assets

---

## Verhältnis zu fuel-dev

| fuel-dev | pwa/ |
|----------|------|
| Lokales Fastify-Backend | Firebase Hosting (statisch) |
| JSON-Files + SQLite | Firestore |
| Python Gemini Scripts | Firebase Functions (geplant) |
| Meal Catalog (einzelne JSONs) | Statischer Build-Asset |
| Supplement Catalog (JSON) | Firestore (Seed aus catalog.json) |

Die beiden Projekte sind **unabhängig**. Änderungen an Meal-Katalog oder Supplement-Seed in fuel-dev müssen manuell in den pwa-Build übernommen werden (kein Auto-Sync).

---

## Offen / Geplant

- Firebase Function: Open Food Facts Proxy
- Firebase Function: Gemini Mikronährstoff-Schätzung
- Firebase Auth (optional, für Multi-User)
- Mikros-Tab mit DACH-Heatmap (nach Functions)
- Datenmigration: fuel-dev JSON-Logs → Firestore (einmalig, Script)
