# Sync-Anleitung für Fuel Centre

Dieses Repo enthält ein Sync-Tool, um deine lokalen JSON-Logs (`data/`) mit Firebase Firestore zu synchronisieren.

## Setup

Der Sync nutzt die Google Cloud Admin-SDK. Sicherstellen, dass der Service Account existiert:
`~/.config/fuel-pwa/service-account.json`

## Sync-Befehle

Um deine lokalen Daten in die Cloud zu bringen (Push):

```bash
# Ersetze <UID> durch deine aktuelle Firebase-UID
npm run sync:push -- <UID>
```

### Wie finde ich meine UID?
1. Öffne deine PWA im Browser unter `https://fuel-aos.web.app`.
2. Öffne die Entwicklertools (F12) -> Reiter "Konsole".
3. Gib folgendes ein und drücke Enter:
   `import { auth } from './src/firebase.js'; console.log(auth.currentUser?.uid);`
   *(Falls das nicht geht: Prüfe `auth.currentUser.uid` direkt in `src/db.js` oder via `console.log` in der App)*.

## Warum das?
Auch wenn du der einzige Nutzer bist, generiert Firebase bei verschiedenen Google-Logins (z.B. falls du dich mal mit einem anderen Google-Account anmeldest) unterschiedliche UIDs. Dieses Tool erlaubt es dir, deinen lokalen Datenbestand ("default") gezielt in den Cloud-Bereich deines aktuellen Accounts zu kopieren.

## Service
Der Watcher für automatische Knowledge-Enrichment-Tasks läuft als System-Service:
`systemctl --user status fuel-sync-watcher.service`
