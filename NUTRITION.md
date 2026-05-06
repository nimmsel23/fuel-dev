# Nutrition Stack — fuel-dev

Ernährungs-Tracking in zwei Ebenen: CLI-Backend für schnelle Eingabe am Desktop,
V2-Web-UI für vollständiges Journal + Makro-Übersicht.

---

## Datenquelle: Open Food Facts

Alle Lebensmitteldaten kommen von **Open Food Facts** (world.openfoodfacts.org) —
öffentliche Datenbank, kein Account nötig, echter Freitext-Suche.

Felder die zurückgegeben werden (pro 100 g):
`name, brand, kcal, kh (Kohlenhydrate), fett, ew (Eiweiß)`

---

## CLI-Backend: wger-food

Repo: `~/Nutrition/bin/wger-food` · Symlink: `~/.local/bin/wger-food`

```bash
wger-food haferflocken      # Suche → fzf-Auswahl → S/M/L/XL Portion → Markdown-Zeile
wger-food banane
wger-food "magerquark"
```

Flow:
1. OFF-API suchen → fzf-Liste mit Nährwerten pro 100 g
2. Portionsgröße wählen: S=100g / M=200g / L=300g / XL=450g (oder Gramm eingeben)
3. Mahlzeit benennen (Vormittag/Nachmittag/Abend)
4. Ausgabe: Obsidian-Markdown-Tabellenzeile → automatisch in `~/Nutrition/logs/YYYY-MM-DD.md`

Log-Format (kompatibel mit Ausbildungs-Vorlage):
```
| Mahlzeit | Uhrzeit | Lebensmittel / Getränk | Menge | Einheit | Kcal | KH (g) | Fett (g) | Eiweiß (g) | Quelle |
```

### Auto-Generator

```bash
wger-generate               # 14-Tage-Protokoll ab heute (~2800 kcal/Tag)
wger-generate --days 7      # 7 Tage (Ernährungstrainer-Modul)
wger-generate --start 2026-05-01
wger-generate --preview     # Nur anzeigen, nicht schreiben
```

Generiert realistische Meal-Kombos für 188 cm / 82,5 kg / sportlich aktiv.
Logs landen in `~/Nutrition/logs/YYYY-MM-DD.md`.

---

## Web-UI: fuel-dev V2

Server: `node server.mjs` (Port 9000)

### API-Endpunkte

| Methode | Pfad | Funktion |
|---------|------|----------|
| GET | `/nutrition/search?q=<query>&limit=<n>` | OFF-Proxy, gibt name/brand/kcal/kh/fett/ew zurück |
| GET | `/nutrition/log?date=YYYY-MM-DD` | Tages-Log laden |
| POST | `/nutrition/log` | Mahlzeit + Wasser loggen |
| GET | `/nutrition/journal?date=YYYY-MM-DD` | Journal-Text |
| POST | `/nutrition/journal` | Journal speichern |
| GET | `/supplements/catalog` | Supplement-Liste |
| POST | `/supplements/log` | Supplement loggen |
| GET | `/supplements/stats` | 30-Tage-Stats + Streak |

### Food Search im UI (Journal-Tab)

Der Journal-Tab enthält einen **Food Search**-Block über dem Meal Logger:

1. Suchbegriff eingeben → debounced → `/nutrition/search?q=`
2. Treffer-Dropdown: Name, Brand, Makros pro 100 g
3. Auswahl → Portionsgröße wählen (S/M/L/XL)
4. Alle Makro-Felder werden automatisch befüllt
5. Auf "Save meal" klicken → schreibt nach `data/nutrition/YYYY-MM-DD.json`

---

## Datenpfade

| Was | Wo |
|-----|----|
| CLI-Logs (Markdown) | `~/Nutrition/logs/YYYY-MM-DD.md` |
| API-Logs (JSON) | `~/fuel-dev/data/nutrition/YYYY-MM-DD.json` |
| Journal | `~/fuel-dev/data/nutrition_journal/YYYY-MM-DD.md` |
| Supplements | `~/fuel-dev/data/supplements/` |

---

## Ausbildungs-Kontext

Das `~/Nutrition`-Repo entstand für die **Vitaltrainer-Ausbildung (FlexyFitAcademy)**:
- **Fitnesstrainer-Modul**: 14-tägiges Ernährungsprotokoll (Zusatzaufgabe)
- **Ernährungstrainer-Modul**: 7-tägiges Ernährungsprotokoll (Pflichtaufgabe)

Format entspricht exakt der Ausbildungsvorlage (Datum, Mahlzeit, Uhrzeit,
Lebensmittel, Menge, Einheit, Kcal, KH, Fett, Eiweiß, Quelle).

Später geplant: Nutrition-Addon für `~/vital` (Klienten-App, selbes Tracking-Prinzip).
