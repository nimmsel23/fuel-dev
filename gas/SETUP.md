# Fuel Micros Enricher — GAS Setup

## Einmalig

```bash
cd ~/fuel-dev/gas
clasp create --title "fuel-micros-enricher" --type standalone
# → trägt scriptId automatisch in .clasp.json ein
clasp push
```

## Script Properties setzen

In GAS Editor: **Project Settings → Script Properties**

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | Key aus `~/.env/gemini.env` |
| `GEMINI_MODEL` | `gemini-2.5-flash` (optional, ist Default) |
| `FIREBASE_PROJECT` | `fitness-aos` (optional, ist Default) |
| `FUEL_UID` | `59ole36uNpNwml5H6VDYCXyCME92` (optional, ist Default) |

## Testen

Im GAS Editor Funktion wählen und ausführen:
- `showNewMeals()` — welche Mahlzeiten fehlen noch
- `testEnrichOne()` — einzelner Gemini-Call testen
- `showCatalogStats()` — aktuellen Stand in Firestore zeigen
- `enrichMicros()` — vollständiger Run manuell

## Trigger aktivieren

```
createDailyTrigger()  → täglich 03:00 Uhr
```

## Updates deployen

```bash
cd ~/fuel-dev/gas
clasp push
```
