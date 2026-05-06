# Fuel Centre

Offlinefähiges Nutrition Journal als PWA plus Node-Server plus CLI-Backend.

Ziel: Ernährungs-Tracking ohne Abhängigkeit von Fremd-Apps — lokal, dateibasiert,
später als Klienten-Feature in `~/vital` integrierbar.

---

## Schichten

| Schicht | Pfad | Port |
|---------|------|------|
| V1 / Fuel Classic | `public/index.html` | 9000 |
| V2 / Fuel Studio | `index.html` + `src/` (Vite/React/Tailwind) | 9000/v2 |
| CLI-Backend | `~/Nutrition/bin/wger-food` | — |

---

## CLI-Backend: wger-food

Schnelles Erfassen ohne UI — Open Food Facts → fzf → Makros skalieren → Markdown-Log.

```bash
wger-food haferflocken     # Suche → fzf-Auswahl → S/M/L/XL Portion → Log-Zeile
wger-generate              # 14-Tage-Protokoll für Ausbildung (~2800 kcal/Tag)
wger-generate --days 7     # 7 Tage
wger-generate --preview    # nur anzeigen
```

Vollständige Doku: [NUTRITION.md](NUTRITION.md)

---

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/health` | Server-Status |
| GET | `/nutrition/search?q=<query>&limit=<n>` | **OFF-Proxy** — Lebensmittel suchen |
| GET | `/nutrition/log?date=YYYY-MM-DD` | Tages-Log laden |
| POST | `/nutrition/log` | Mahlzeit + Wasser loggen |
| GET | `/nutrition/journal?date=YYYY-MM-DD` | Journal-Text |
| POST | `/nutrition/journal` | Journal speichern |
| GET | `/nutrition/journal/list` | Alle Journal-Einträge |
| GET | `/supplements/catalog` | Supplement-Katalog |
| POST | `/supplements/catalog` | Supplement anlegen |
| GET | `/supplements/log?date=YYYY-MM-DD` | Tages-Einnahmen |
| POST | `/supplements/log` | Supplement loggen / löschen |
| GET | `/supplements/stats?days=30&anchor=YYYY-MM-DD` | Streak + 30-Tage-Stats |
| GET/POST | `/fuel/log` | Legacy Fuel-Logging |
| GET | `/fuel/progress` | Alle Legacy-Logs |

### `/nutrition/search` — Open Food Facts Proxy

```bash
# Lokal testen:
http :9000/nutrition/search q==haferflocken limit==10
```

Antwort:
```json
{
  "ok": true,
  "count": 8,
  "results": [
    { "name": "Haferflocken", "brand": "Kölln", "kcal": 363, "kh": 56, "fett": 6.7, "ew": 13 }
  ]
}
```

---

## V2 Food Search (Journal-Tab)

Im Journal-Tab ist über dem Meal Logger ein **Food Search**-Block:

1. Suchbegriff tippen → debounced (350 ms) → `/nutrition/search`
2. Dropdown mit Nährwerten pro 100 g (Name, Brand, Kcal, P/C/F)
3. Auswahl → Portionsgröße: **S** 100 g / **M** 200 g / **L** 300 g / **XL** 450 g
4. Alle Makro-Felder des Formulars werden automatisch befüllt
5. Save meal → schreibt nach `data/nutrition/YYYY-MM-DD.json`

---

## Datenpfade

| Was | Wo |
|-----|----|
| API-Logs (JSON) | `data/nutrition/YYYY-MM-DD.json` |
| Journal | `data/nutrition_journal/YYYY-MM-DD.md` |
| Supplements | `data/supplements/` |
| CLI-Logs (Markdown) | `~/Nutrition/logs/YYYY-MM-DD.md` |

---

## Start

```bash
npm install
npm start              # Port 9000
npm run dev            # nodemon + Vite parallel
npm run build          # Vite baut nach /opt/fuel
npm run prod           # Port 8000, /opt/fuel als Static Root
```

Einstiege:
- `http://127.0.0.1:9000/` → V1 / Fuel Classic
- `http://127.0.0.1:9000/v2` → V2 / Fuel Studio

---

## Stack

**Backend:** Node.js, kein Framework, kein ORM — plain `http` + `fs`.  
**Frontend V2:** React 18, Tailwind 3, FullCalendar, TanStack Query, Recharts, Zustand, Zod, React Hook Form.  
**Datenquelle:** Open Food Facts (kein Account, kein API-Key).
