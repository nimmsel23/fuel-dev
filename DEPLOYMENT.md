# Fuel Centre — Deployment & App-Architektur

Dieses Dokument beschreibt die Trennung zwischen der **Cloud-Instanz (V3)** und der **lokalen Instanz (V2)**.

## 1. Die zwei Welten

Fuel Centre operiert in zwei getrennten Umgebungen mit unterschiedlichen Schwerpunkten.

### Cloud-PWA (V3)
- **Status:** Die moderne, AI-gestützte Version für das Handy.
- **Umgebung:** Firebase Hosting (`fuel-aos.web.app`)
- **Daten:** Google Firestore (Cloud)
- **Features:** Schnelles AI-Logging, Heatmap, Dashboard.
- **Build-Befehl:** `fuelctl dev build client` (Erzeugt `dist-client/`)

### Lokale Instanz (V2)
- **Status:** Die originale Power-Version (Pre-Firebase) für den Desktop.
- **Umgebung:** Lokaler Node.js Server (Port 7000), Pfad: `/opt/fuel`
- **Daten:** Lokale JSON-Dateien (`data/`) & SQLite.
- **Features:** Recipe Builder, wger-Suche, lokaler Katalog-Master.
- **Start:** `npm run prod` im Ordner `/opt/fuel`.

---

## 2. Deployment-Prozess (V3)

Das Deployment nach Firebase erfolgt nur bei Änderungen am Client-Code automatisch (via Git-Hook). Manuell kann es so ausgelöst werden:

1.  **Build erzeugen:**
    ```bash
    fuelctl dev build client
    ```
2.  **Deploy nach Firebase:**
    ```bash
    firebase deploy --only hosting
    ```

---

## 3. System-Steuerung (`fuelctl`)

Das Tool `fuelctl` dient als Master-Controller für die lokale Umgebung.

- **`fuelctl status`**: Zeigt den Zustand von Dev (9000), V2 (7000) und Sync an.
- **`fuelctl dev up`**: Startet das lokale Entwicklungslabor (Port 9000).
- **`fuelctl sync`**: Gleicht lokale Daten (V2) mit der Cloud (V3) ab.

---

## 4. Lokale Entwicklung

Für die Arbeit an der modernen V3-Basis:
```bash
fuelctl dev up
```
Dies startet das Backend auf Port 9000 und die UI auf 5173.
