# Dependencies (Abhängigkeiten)

Dieses Dokument listet alle relevanten technologischen Abhängigkeiten des Fuel Trackers auf und erklärt deren Einsatzzweck.

## Infrastruktur & Laufzeitumgebung

| Technologie | Version | Zweck |
|-------------|---------|-------|
| **Python** | 3.10+ | Die primäre Programmiersprache des Backends. |
| **Poetry** | 1.x+ | Paketmanager für Python. Sorgt für exakt reproduzierbare Umgebungen (`poetry.lock`) und verwaltet die `pyproject.toml`. |
| **PostgreSQL** | 15+ | Die relationale Datenbank für die Produktion. Bietet extrem verlässliche Datenspeicherung und exzellenten JSON-Support (für die Zutaten-Listen). |
| **Docker** | - | Wird genutzt, um die PostgreSQL-Datenbank (`docker-compose.yml`) lokal isoliert bereitzustellen. |

## Python Core-Libraries (Production)

Diese Bibliotheken sind für die eigentliche Ausführung der Anwendung zwingend notwendig:

- **`google-genai`**: 
  - *Zweck*: Das offizielle SDK von Google für die Gemini-Modelle (speziell `gemini-2.5-flash`). Es handhabt die komplette API-Kommunikation.
- **`pydantic`**: 
  - *Zweck*: Daten-Validierung. Wird primär genutzt, um Gemini via "Structured Output" ein striktes JSON-Schema aufzuzwingen und die erhaltenen Daten sofort in typensichere Python-Objekte zu verwandeln.
- **`sqlalchemy`**: 
  - *Zweck*: Der Object-Relational Mapper (ORM). Erlaubt uns, Datenbank-Tabellen als Python-Klassen zu schreiben und abstrahiert die SQL-Befehle komplett weg.
- **`psycopg2-binary`**: 
  - *Zweck*: Der unterliegende PostgreSQL-Treiber für Python (den SQLAlchemy intern verwendet, um mit der Datenbank zu sprechen).
- **`alembic`**: 
  - *Zweck*: Das Migrations-Werkzeug für SQLAlchemy. Ermöglicht es, das Datenbankschema über die Zeit iterativ anzupassen (z.B. neue Spalten hinzuzufügen), ohne Daten zu verlieren.
- **`python-dotenv`**: 
  - *Zweck*: Lädt Umgebungsvariablen (wie den `GEMINI_API_KEY` und die `DATABASE_URL`) beim Start komfortabel aus der lokalen `.env` Datei.

## API & Externe Abhängigkeiten

- **Gemini API (Google)**:
  - Ohne eine funktionierende Internetverbindung und einen gültigen API-Key (mit Kontingent) kann die Anwendung keine Freitexte in Makros übersetzen.
