# Fuel Centre — Deployment & App-Architektur

Dieses Dokument beschreibt die Trennung zwischen der **Klienten-PWA (V2)** und der **Coach-Zentrale (V3)**.

## 1. Die zwei Modi

Fuel Centre operiert in zwei völlig getrennten Umgebungen, die auf demselben Quellcode basieren, aber unterschiedliche Backends nutzen.

### Klienten-PWA (Cloud / V2)
- **Umgebung:** Firebase Hosting (`fuel-aos.web.app`)
- **Daten:** Google Firestore (Cloud)
- **Features:** Schlankes Tracking für Klienten, kein Coach-Tab, keine lokalen API-Anfragen.
- **Build-Befehl:** `npm run build:client` (Erzeugt `dist-client/`)

### Coach-Zentrale (Lokal / V3)
- **Umgebung:** Lokaler Node.js Server (Port 9000), Localhost oder Tailscale.
- **Daten:** Lokale JSON-Dateien (`data/`) & SQLite.
- **Features:** Voller Zugriff auf wger-Suche, Recipe Builder (Compose), lokale Katalog-Pflege.
- **Build-Befehl:** `npm run build:coach` (Erzeugt `dist/`)

---

## 2. Deployment-Prozess

Das Deployment nach Firebase erfolgt **manuell**, um die Stabilität der Klienten-App zu gewährleisten. Der automatische `post-commit` Hook wurde deaktiviert.

### Schritte für ein Klienten-Update:
1.  **Build erzeugen:**
    ```bash
    npm run build:client
    ```
2.  **Deploy nach Firebase:**
    ```bash
    firebase deploy --only hosting
    ```
    *Hinweis: `firebase.json` ist so konfiguriert, dass sie NUR den Inhalt von `dist-client/` hochlädt.*

---

## 3. Technische Trennung (Code-Ebene)

Die Trennung erfolgt auf zwei Ebenen:

### A. API-Weiche (`src/client/lib/api.js`)
Die Funktion `isCloud()` erkennt anhand des Hostnames, ob die App in der Cloud läuft.
- `true` -> Anfragen werden an das `firestore-db.js` Modul umgeleitet.
- `false` -> Echte HTTP-Anfragen gehen an das lokale Backend (Port 9000).

### B. Build-Time Filter (`vite.config.js`)
Über die Umgebungsvariable `VITE_APP_MODE` wird beim Kompilieren entschieden, welche Teile inkludiert werden.
- Im `client`-Modus wird der `CoachView.jsx` Code durch Tree-Shaking entfernt.

---

## 4. Lokale Entwicklung

Für die tägliche Arbeit als Coach:
```bash
npm run dev
```
Dies startet das lokale Backend und den Vite-Dev-Server. In diesem Modus ist der **Coach-Tab** sichtbar und alle Änderungen landen in deinen lokalen `data/` Ordnern.

Um lokale Master-Daten (z.B. neue Katalog-Einträge) für die Klienten freizugeben, nutze die Sync-Scripte:
```bash
npm run sync:push
```
