# Systemarchitektur: Fuel Tracker

Der Fuel Tracker wurde bewusst als simpel gehaltenes, modulares Python-Backend ("Prod-like") konzipiert, das sich von historisch gewachsenen Node/Python-Mischarchitekturen (wie im alten `fuel-dev` Verzeichnis) verabschiedet. 

## Kern-Architektur

Das System basiert auf folgenden drei Säulen:

1. **Python 3 Backend**: Verwaltet durch Poetry für striktes Dependency-Management.
2. **Relationales Datenmodell (PostgreSQL)**: Als verlässlicher Single-Point-of-Truth für alle getrackten Mahlzeiten.
3. **LLM als "Intelligenter Parser"**: Anstatt einer komplexen internen Suchmaschine für Nährwerte übernimmt die Gemini API die Aufgabe, natürlichen Text in harte Fakten (Makros) zu übersetzen.

## Verzeichnisstruktur

```text
/home/alpha/fuel/
├── .agents/                 # AlphaOS Meta-Instruktionen (z.B. AGENTS.md)
├── alembic/                 # Datenbank-Migrations-Historie
├── fuel_tracker/            # Das eigentliche Python-Package
│   ├── core/                # Globale Konfigurationen (z.B. env-Loader) und LLM-Logik
│   ├── db/                  # SQLAlchemy Engine, Session und die DB-Modelle
│   └── schemas/             # Pydantic-Modelle (Schablonen für die KI-Antworten)
├── main.py                  # CLI-Einstiegspunkt
├── docker-compose.yml       # Lokales PostgreSQL Setup
└── pyproject.toml           # Poetry Konfiguration
```

## Datenfluss

1. **User Input**: Der Nutzer ruft `main.py` mit einem Freitext-String auf (z.B. *"Ich aß 3 Eier mit Speck"*).
2. **NLP-Parsing (`core/llm.py`)**: 
   - Der Text wird samt Prompt an die Gemini API gesendet.
   - Durch das `response_schema` zwingen wir das LLM, exakt im Format unseres Pydantic-Modells (`schemas/food.py`) zu antworten.
3. **Validierung (`schemas/food.py`)**: 
   - Pydantic stellt sicher, dass die Antwort korrekt typisiert ist (Zahlen für Makros, Arrays für Zutaten).
4. **Persistierung (`db/models.py`)**: 
   - Das Objekt wird an SQLAlchemy übergeben und dauerhaft und typsicher als `FoodLog` in der PostgreSQL-Datenbank abgelegt.

## Warum diese Architektur?

- **Keine Copy-Paste Fehler**: Es gibt keine Altlasten. Das System ist strikt in Schichten (DB, Core-Logik, Schemas) getrennt.
- **Robustheit**: Die Kombination aus Pydantic (Validierung), SQLAlchemy (ORM) und Alembic (Migrationen) sorgt für ein 100% stabiles, skalierbares "Prod-Level" Setup.
- **Einfachheit**: Anstatt Datenbanken mit 10.000 Zutaten lokal zu pflegen, ist das LLM unsere dynamische Lebensmittel-Datenbank.

## Erweiterungen & API Integration

### 1. "Journal-First" Datenmodell (DailyJournal)
Um den späteren Übergang zu Firestore/NoSQL so einfach wie möglich zu gestalten, wurde das Datenmodell auf ein tägliches Journal-Dokument umgestellt (`DailyJournal` in `db/models/journal.py`):
- Die Tabelle speichert Zeilen mit dem Datum als Primärschlüssel (z. B. `2026-07-10`).
- Essen (`food_logs`) und Gewohnheiten/Supplements (`habits`) werden als native JSON-Arrays (JSONB) abgelegt.
- Supplements werden im Backend als spezifische Unterform von Habits (`type: "supplement"`) behandelt.

### 2. Kalorien-Namenskonvention (`calories` vs. `kcal`)
Um Namenskonflikte mit Tools der Desktop-Umgebung (wie dem KDE-Kalender `KCal`) im Code zu vermeiden, gilt folgende Richtlinie:
- **Backend/API**: Nutzt durchgängig den Begriff `calories` (z. B. in Datenbank-Modellen und API-Feldern).
- **Frontend/UI**: Mappt die Backend-Daten auf den nutzerfreundlichen und gängigen Begriff `kcal` für die Anzeige auf dem Control Deck.

### 3. Frontend-Auslieferung (SPA Hosting)
Das FastAPI-Backend dient gleichzeitig als Produktions-Webserver für das React-Frontend:
- Der Vite-Build (`npm run build`) kompiliert die App nach `frontend/dist`.
- FastAPI liefert statische Assets unter `/assets` aus und leitet alle virtuellen SPA-Routen über einen Catch-All-Handler direkt auf die `index.html` weiter, damit das clientseitige Routing reibungslos funktioniert.
- Die gesamte Anwendung läuft autark auf Port `4000` (`8000` war durch einen fremden Docker-Container (`vitalos_api`, separates Projekt) belegt).

