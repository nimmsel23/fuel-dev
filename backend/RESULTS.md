# Fuel Tracker - Results

## 2026-07-09
- Initiale Projektstruktur mit TODO.md und RESULTS.md nach AlphaOS-Vorgaben erstellt.
- Refactoring von CalendarView und zugehörigen Hooks (useNutrition, useSupplements, api.js) für das neue FastAPI-Backend. Legacy Firestore-Code entfernt.
- Refaktorisierung aller 9 Frontend-Views und konfliktfreies Zusammenführen (Merge) aller Git-Zweige.
- Umbau des Backends auf eine neue, "Journal-First" DailyJournal Datenbank-Architektur (JSON-basiertes Dokumentenmodell für einfachere spätere NoSQL-Migration).
- Auslieferung des gebauten Frontends direkt über den FastAPI-Server (Port 8000) inklusive SPA-Routing.

- 2026-07-10: Optimised micro nutrients calculation for future Firestore migration. Added `micros_sum` pre-calculated property to `DailyJournal` to prevent massive client-side calculations and inefficient nested loop queries. Matched Pydantic MicroNutrients schema keys to DACH standard keys for correct mapping. Created `/journal/range` endpoint to correctly query multiple days in bulk and modified `useMicrosWeekly` hook to use it.
- 2026-07-10: Optimised DB (SQLite/Firestore) storage: Removed redundant nested `micros` dictionary from individual meal entries inside `food_logs` array. Micros are now strictly aggregated into `micros_sum` at the `DailyJournal` level. Fixed `water_ml` column type to Integer.
