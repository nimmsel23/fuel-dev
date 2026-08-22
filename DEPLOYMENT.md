# Fuel Centre — Deployment & App-Architektur

Dieses Dokument beschreibt den aktuellen Übergang zwischen **v3** (Node/Fastify)
und **v4** (Python/FastAPI).

## 1. Die zwei Laufzeit-Schichten

Fuel Centre operiert aktuell mit zwei koexistierenden Schichten.

### v3
- **Rolle:** Aktueller Node/Fastify-Entry-Point und Kompatibilitäts-Layer.
- **Dev:** `:9000`
- **Desktop-Prod:** `fuel.service` auf `:7000`, WorkingDirectory `/opt/fuel`
- **Cloud:** Firebase Hosting (`fuel-vos.web.app`)
- **Besonderheit:** Kann `/v4/*` an das Python-Backend weiterreichen.

### v4
- **Rolle:** Eigentliche Nachfolger-Architektur mit FastAPI + React-Frontend.
- **Dev:** `:4000`
- **Code:** `backend/` + `frontend/`
- **Besonderheit:** Servt sein eigenes gebautes Frontend und kann `/v3/*` zurück an v3 weiterreichen.

---

## 2. Automatisierung & Daemons

### Firestore Sync Watcher
Ein Daemon-Prozess überwacht lokale Änderungen und gleicht sie mit der Cloud ab.
- **Service:** `fuel-sync-watcher.service`
- **Script:** `scripts/firestore-sync.mjs watch`

### Inbox (Geplant)
Eine Inbox-Funktion für die schnelle Erfassung von Rohdaten zur späteren Katalogisierung.

---

## 3. Deployment-Prozess

### Desktop lokal
- `fuelctl dev deploy`: `~/fuel-dev -> ~/.local/fuel`
- `fuelctl prod deploy`: `~/.local/fuel -> /opt/fuel` plus `/opt/fuel-python`

Aktueller Desktop-Prod-Zustand:
- der laufende systemd-Entry-Point ist noch **v3** (`fuel.service`)
- v4 wird bereits nach `/opt/fuel-python` mitdeployt, ist aber noch nicht der aktive Prod-Service

### Firebase
Das Deployment nach Firebase erfolgt getrennt für die Cloud-Seite.

1.  **Manueller Build:** `fuelctl dev build`
2.  **Manueller Deploy:** `firebase deploy --only hosting`

---

## 4. System-Steuerung (`fuelctl`)

Das Tool `fuelctl` dient als Master-Controller für die lokale Umgebung.

- **`fuelctl status`**: Zeigt den Zustand der lokalen Runtime-Schichten und des Sync-Watchers an.
- **`fuelctl dev up`**: Startet die lokale Runtime.
- **`fuelctl sync`**: Manueller Datenabgleich für die Cloud-/Firestore-Seite.
