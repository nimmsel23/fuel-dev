# Fuel Centre

Fuel ist ein mobiles Ernährungstagebuch für Mahlzeiten, Nährstoffübersichten und Supplements. Die Web-App nutzt React und Vite und ist als installierbare PWA ausgelegt.

## Repo-Übersicht

- `index.html` und `src/client/` — aktuelle Vite-App. Die Datei bleibt kleingeschrieben: Sie ist Vites Root-Einstieg; auch GitHub Pages erwartet den Dateinamen `index.html` exakt in dieser Schreibweise.
- `public/` — statische Assets und die erhaltene Fuel-Classic-Oberfläche.
- `docs/README.md` — Einstieg der Dokumentationsseite, die GitHub Pages aus `docs/` veröffentlicht.
- `docs/apps.html` — Übersicht der Fuel-Hosting-Apps.
- `../fuel-backend/` — separates Nachbar-Repo für Node-Backend, Firestore-Sync und serverseitige Werkzeuge.
- `../fuel-frontend/` — separates Repo für das pausierte Fuel-Centre-4.0-Frontend-Experiment. Das aktive Frontend bleibt `src/client/` in diesem Repo.

Der Root-Einstieg `index.html` gehört zur App und ist nicht die Startseite der Dokumentation. GitHub Pages veröffentlicht deshalb den Ordner `/docs`; so bleiben Doku-Seite und Vite-Einstieg getrennt, ohne `index.html` umzubenennen.

## Lokal entwickeln

Dieses Repo verwendet pnpm. Der lokale Supervisor setzt voraus, dass das Nachbar-Repo `fuel-backend` ausgecheckt ist.

```bash
pnpm install
pnpm run dev
```

Die Build-Kanäle stehen in [`package.json`](package.json). Lokaler Build und Firebase-Build verwenden getrennte Vite-Konfigurationen und Ausgabeordner. Release-Schritte stehen in der [Deployment-Doku](DEPLOYMENT.md).

## Produkt- und Technik-Doku

- [Ernährungs-Stack](NUTRITION.md)
- [Architektur](ARCHITECTURE.md)
- [Firebase-Anbindung](FIREBASE.md)
- [Deployment](DEPLOYMENT.md)
- [Repo-Regeln und Release-Grenzen](AGENTS.md)
- [Fuel-Apps](docs/apps.html)

## Daten und Backend-Grenze

Der Cloud-Datenpfad ist in [FIREBASE.md](FIREBASE.md) beschrieben. Backend-Code und serverseitige Abläufe gehören nach `fuel-backend`; dieses Repo enthält den aktiven Web-Client und seine statischen Assets. Persönliche Ernährungsdaten, lokale `.env`-Dateien und generierte Build-Ausgaben werden nicht eingecheckt.

## Release-Weg

`dev` ist der Entwicklungsbranch. Der eigenständige Firebase-Release und der Quellstand in der VitalOS-Shell sind getrennte Release-Flächen. Für Releases gelten [DEPLOYMENT.md](DEPLOYMENT.md) und die aktuelle Repo-Automation; nicht aus einem lokalen Checkout deployen.
