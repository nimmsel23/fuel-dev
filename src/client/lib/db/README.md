# Fuel Centre Database Layer

Dieses Verzeichnis enthält die gekapselte Datenbank-Logik für Fuel Centre.

## Architektur

Fuel Centre nutzt eine proxy-basierte Architektur:
- **Local Mode:** API-Aufrufe gehen gegen den lokalen Fastify-Server (siehe `api.local.js`).
- **Cloud Mode (`--mode firebase`):** API-Aufrufe werden via `api.cloud.js` direkt auf das Firestore-SDK umgeleitet.

## Modularisierung (`firestore/`)

Der Cloud-Mode greift direkt auf Firestore zu. Um den Code wartbar zu halten, wurde die Firestore-Logik modularisiert (angelehnt an das Pattern in `fitness-dev`):

- `core.js` – Auth, Firebase-Initialisierung und `getUid()`.
- `nutrition.js` – Logik für Mahlzeiten, Tageslogs, History und Makro-Aggregation.
- `supplements.js` – Logik für Supplement-Logs, Katalog und Statistik.
- `journal.js` – Freitext-Tagebucheinträge.
- `settings.js` – Benutzereinstellungen.
- `utils.js` – Hilfsfunktionen (z.B. Datums-Parsing, Mikro-Konstanten).

## Barrels & Exporte

- **`index.js` (lokal):** Fasst fallweise Wrapper zusammen.
- **`firestore/index.js`:** Fasst alle aufgesplitteten Firestore-Module zusammen.
- **`../db.firestore.js`:** Der primäre Barrel, der von den Views und Hooks im Frontend importiert wird. Er exportiert den gesamten Inhalt aus `db/firestore/index.js`.
- **`../firestore-db.js`:** Veralteter Legacy-Wrapper, der aus Kompatibilitätsgründen (für Crossover-Imports anderer Repos) noch existiert und lediglich auf `db.firestore.js` weiterleitet.

## Wichtige Regeln
- Imports im Frontend sollten immer über `import * as firestore from "../lib/db.firestore.js"` erfolgen, **niemals** direkt auf die Unterdateien.
- Neue Firestore-Funktionen sollten passend zu ihrem View in `firestore/` angelegt und über `firestore/index.js` nach außen gegeben werden.
