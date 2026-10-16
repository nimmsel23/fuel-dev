# VitalOS Supplements

Eigenständig installierbare PWA mit eigenem Einstieg (`src/client/solo-main.jsx`), Google-Login, Tagesroutine, Einnahmen, Katalog, Auswertung und Reminder-Einstellungen.

Die Source bleibt in `fuel-dev`; der Solo-Build lädt kein Fuel-Dashboard und fragt nur Supplement-Daten ab. Bestehende Produkte und Einnahmen bleiben im kontogebundenen Firestore-Datenbestand (`supplements/{uid}`). Keine Datenmigration nötig.

## Build und Veröffentlichung

```sh
pnpm run build:solo:supplements
pnpm run deploy:solo:supplements
```

Output: `dist-solo-supplements`. Hosting-Ziel: `supplements`, Site: `vos-fuel-supplements`, Projekt: `fitness-aos`.

URL: https://vos-fuel-supplements.web.app

Der Deploy betrifft ausschließlich dieses Hosting-Ziel. Firestore-Regeln bleiben in VitalOS; vorhandene Reminder-Functions bleiben zuständig. Push benötigt Browser-Freigabe, ein registriertes Gerät und den vorhandenen Cloud-Scheduler.

## Funktionen

- Tagesfortschritt und nach Tageszeit gruppierte Routine.
- Schnellerfassung und freie Einnahmen mit Notizen.
- Habit-Wochentracker pro Supplement (Montag bis Sonntag), Wochenwechsel, Suche, Plan-/Einnahmestatus und rückwirkende Erfassung. Mehrere Einnahmen sind sichtbar; ein erneuter Klick entfernt die letzte. Zukünftige Tage zeigen nur den Plan.
- Einnahmen und Entfernen erscheinen sofort im gemeinsamen Tagescache. Cloud-Befehle werden zuerst kontogebunden im lokalen Outbox-Speicher gesichert, danach im Hintergrund synchronisiert. Bei Fehlern bleibt die Änderung sichtbar in der Statusleiste und kann erneut synchronisiert oder verworfen werden; abgelehnte Befehle werden nicht als erfolgreiche Einnahmen projiziert.
- Katalogsuche, Planfilter, tägliche/wöchentliche/zyklische Pläne und Einnahme bei Bedarf.
- 30-Tage-Auswertung bis zum gewählten Datum: tatsächliche Einnahmetage und Tages-Serie.
- Reminder-Zeiten und Push-Registrierung; Änderungen speichern nur die zugehörigen Settings-Felder.
- Lade-/Fehlerzustände, Wiederholen, Ersteinrichtung und Rückmeldung zu Schreibaktionen.

## Prüfung

`node --experimental-test-module-mocks --test tests/*.test.mjs` prüft unter anderem Kalenderpläne, Startdatum/Intervalle, doppelte Einnahmen und Statistik-Zeitfenster. Der Solo-Build erzeugt Manifest, Icons und Service Worker. Ein Build ersetzt keinen angemeldeten Geräte-Test für Cloud-Schreibzugriffe und Push-Zustellung.
