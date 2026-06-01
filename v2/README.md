# Fuel Centre — Setup & Deployment

Dieses Repository enthält das gesamte Fuel-System: das Node.js Backend, das Vite Frontend (V2) und alle notwendigen Skripte für den Betrieb.

## Architektur
- **/opt/fuel**: Produktionsverzeichnis für das Backend und das Frontend.
- **/var/lib/fuel/data**: Persistente Daten (Logs, Kataloge).
- **Firebase Hosting**: Hostet das `pwa/`-Replica für mobile Offline-Nutzung.
- **systemd**: Hält das Backend (`fuel-backend.service`) permanent am Laufen.

## Setup (Einmalig)
Um das System auf einem neuen Server zu installieren, führe das Setup-Skript aus:

```bash
./setup.sh
```
Dieses Skript:
1. Erstellt Verzeichnisse (`/opt/fuel`, `/var/lib/fuel/data`).
2. Setzt Rechte.
3. Führt das Deployment aus.
4. Registriert und startet den systemd-Service.

## Täglicher Workflow
Wenn du Änderungen am Code vorgenommen hast:

1. **Deployment**:
   ```bash
   ./deploy.sh
   ```
   Dies kopiert den aktuellen Code nach `/opt/fuel` und installiert Produktions-Abhängigkeiten.

2. **Backend-Service**:
   Der Service startet nach dem Deploy automatisch neu. Status prüfen:
   ```bash
   systemctl --user status fuel-backend.service
   ```

## Daten-Synchronisation (Firebase <-> Lokal)
Deine lokalen Daten in `/var/lib/fuel/data` werden nicht automatisch mit der PWA in der Cloud synchronisiert. Nutze dafür die Sync-Skripte:

- **Lokal → Cloud (Push)**:
  ```bash
  npm run sync:push -- <UID>
  ```
- **Cloud → Lokal (Pull)**:
  ```bash
  npm run sync:pull -- <UID>
  ```
*Hinweis: Die `<UID>` findest du in der PWA-Konsole über `auth.currentUser.uid`.*

## Knowledge Enrichment (Gemini)
Das System nutzt einen Hintergrund-Watcher, der Aufgaben in Firestore überwacht:
```bash
systemctl --user status fuel-sync-watcher.service
```
Wenn die PWA ein Enrichment anfordert, wird dies vom lokalen Laptop (via Gemini API) verarbeitet.

## Administration
Um User zu verwalten oder Daten manuell zu prüfen:
- **User-Liste**: `firebase auth:export users.json --project fuel-aos --format=json`
- **Firestore-Daten**: `gcloud firestore documents list "nutrition/<UID>"`
