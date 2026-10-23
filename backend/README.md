# Fuel Python API

`backend/` ist der FastAPI-Port des Fuel-Trackers. Der Tagesdatensatz wird in
`DailyJournal` gespeichert; Food- und Supplement-Einträge sowie deren
Mikronährstoffprofile bleiben innerhalb des Tagesdatensatzes nachvollziehbar.

## Start

Benötigt Python 3.11 oder neuer. Aus dem Repository-Root:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
backend/.venv/bin/python -m backend.migrate
backend/.venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 4000
```

`backend/start-server.sh` und `bin/fuel-devctl` führen die Migration vor dem
Serverstart aus. Der API-Startup prüft und aktualisiert das Schema ebenfalls.
Für Schätzungen muss `GEMINI_API_KEY` in der Umgebung oder in
`~/.env/fuel.env` gesetzt sein. Ohne Gemini liefern Schätzrouten HTTP 503 und
speichern keine erfundenen Werte.

## Datenbank und Migrationen

Standardmäßig verwendet Fuel
`~/.aos/fuel/nutrition/nutrition.db`. `DATABASE_URL` kann auf eine andere
SQLite- oder PostgreSQL-Datenbank zeigen. Alembic verwaltet Schemaänderungen;
`create_all()` wird beim Start nicht mehr als Upgrade-Ersatz verwendet.

Ein vollständiges, bisher unversioniertes v4-Schema wird einmalig auf die
bekannte Basisrevision gestempelt und danach bis zum aktuellen Stand migriert.
Bei einem unvollständigen Schema bricht der Start mit einer Diagnose ab,
anstatt Tabellen oder Daten still zu überschreiben. Vor manuellen Migrationen
sollte eine Sicherung der Datenbank erstellt werden.

Details zu den behobenen Fehlern und zu älteren aggregierten Mikronährstoffen
stehen in [BUGFIXES.md](BUGFIXES.md).
