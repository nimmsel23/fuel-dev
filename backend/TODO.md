# Fuel Tracker - TODO

## Ziel
Ein simples, deppensicheres System zur Erfassung von Makros (und Mikros) wie ein Journal.
Anstatt manueller Eingabe einzelner Zutaten, soll die Mahlzeit als Freitext (NLP) via Gemini-API analysiert und in einem Katalog in einer relationalen Datenbank (PostgreSQL/MariaDB) gespeichert werden.

## Aufgaben
- [x] Initialisierung eines sauberen Python-Projekts (Poetry).
- [x] Definition der Kern-Abhängigkeiten (`sqlalchemy`, `pydantic`, `google-genai`, `python-dotenv`).
- [x] Einrichtung der Datenbank-Architektur (SQLAlchemy) mit Katalog-Tabelle für Gerichte.
- [x] Integration der Gemini-API für NLP-Makro-Extraktion.
- [x] Erstellung einer Anleitung für zukünftige Agenten (`AGENTS.md`).
- [x] Dokumentation des Setups (`README.md`).
- [x] Refactoring von `JournalVosView` und Hooks zur Nutzung des FastAPI-Backends.
- [x] Refactor MicrosView für neues FastAPI Backend.

## Nächste Schritte
- [x] SettingsView und zugehörige Hooks für neues FastAPI Backend refactoren.
- [x] Refactoring von LogView und SupplementsView für neues FastAPI Backend (Entfernen von Legacy-Code).
- [x] Backend-Umbau auf DailyJournal-Architektur.
- [x] Integration des Frontends direkt im FastAPI-Backend (Auslieferung über Port 8000).

