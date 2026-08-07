# Fuel Tracker

Ein simples, NLP-gestütztes Makro- und Ernährungs-Journal.
Anstatt manuell einzelne Zutaten in einer App zu suchen, schreibst du einfach im Freitext, was du gegessen hast (z.B. "Ich hatte einen großen Teller Spaghetti Bolognese mit extra viel Parmesan"). 
Die Gemini-API analysiert die Mahlzeit, bricht sie in Zutaten auf, schätzt die Makros (Protein, Kohlenhydrate, Fett, Kalorien) und speichert das Ergebnis in einer SQL-Datenbank ab.

## Voraussetzungen
- Python 3.10+
- Poetry
- Gemini API Key (`GEMINI_API_KEY` in der `.env` oder der Umgebung)

## Installation

```bash
cd /home/alpha/fuel
poetry install
```

## Nutzung (CLI)

```bash
# Beispiel-Nutzung über die CLI
poetry run python main.py "250g Magerquark mit einer Handvoll Blaubeeren und 30g Mandeln"
```

Dies wird:
1. Eine SQLite Datenbank (`fuel_tracker.db`) anlegen (sofern nicht anders über `DATABASE_URL` konfiguriert).
2. Gemini nach den Makros fragen.
3. Die Mahlzeit als Eintrag in der Datenbank speichern.
