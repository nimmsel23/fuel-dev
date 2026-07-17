# Firestore Implementation Layer

Dieses Verzeichnis enthält die spezifische Implementierung der Firestore-Datenbankzugriffe für den Cloud-Mode der App.

Um den Code wartbar zu halten, wurde die Logik thematisch in einzelne Module aufgesplittet:
- `core.js` – Basis (Firebase Auth, Firestore-Instanzen, UID-Helfer)
- `nutrition.js` – Mahlzeiten, Macros, Tracking-Historie
- `supplements.js` – Supplement-Katalog und Supplement-Einnahme-Logs
- `journal.js` – Freitext-Logs
- `settings.js` – Benutzerspezifische Einstellungen
- `utils.js` – Hilfsfunktionen (Datums-Helfer)

**Wichtig:**
Alle diese Module werden in der `index.js` dieses Ordners zusammengefasst. 
Die Anwendung im Frontend importiert diese Methoden jedoch **niemals direkt von hier**, sondern immer über den zentralen Barrel `../../db.firestore.js`, der alles aus diesem Layer nach außen gibt.
