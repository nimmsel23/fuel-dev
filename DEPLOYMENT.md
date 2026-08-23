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

Der lokale Desktop-Deploy ist bewusst zweistufig:

1. **Dev-Checkout -> Staging**
   - Quelle: `~/fuel-dev`
   - Ziel: `~/.local/fuel`
   - Mechanik: `deploy.sh staging`
   - Wrapper: `fuel-devctl deploy` bzw. `fuelctl dev deploy`
   - Zweck: gebauter, versionierbarer Zwischenstand außerhalb des aktiven
     Arbeits-Checkouts

2. **Staging -> Localhost-Prod**
   - Quelle: `~/.local/fuel`
   - Ziele: `/opt/fuel` (Node) und `/opt/fuel-python` (Python)
   - Mechanik: `deploy.sh prod`
   - Wrapper: `fuel-prodctl deploy` bzw. `fuelctl prod deploy`
   - Zweck: echter localhost-Prod-Stand unter systemd

Die Wrapper-Rollen sind:
- `deploy.sh`: eigentliche Deploy-Logik
- `fuel-devctl`: Dev-/Staging-Controller, ruft für Builds/Deploys `deploy.sh staging`
- `fuel-prodctl`: Prod-Controller, ruft `deploy.sh prod` und verwaltet die
  systemweiten Units
- `fuelctl`: höherer Dispatcher; reicht `dev` an `fuel-devctl` und `prod` an
  `fuel-prodctl` weiter
- `fuel-release`: Top-Level-Release-Wrapper für die Weitergabe Richtung
  Firebase-Release-Linie

Lokale Ports:
- Dev Node / v3: `http://127.0.0.1:9000`
- Dev Python / v4: `http://127.0.0.1:4000`
- Localhost-Prod Node / `fuel.service`: `http://127.0.0.1:7000`
- Localhost-Prod v4-Proxy über Node: `http://127.0.0.1:7000/v4/*`

Wichtig:
- `~/.local/fuel` ist Staging, nicht der Live-Prod-Stand
- `/opt/fuel` und `/opt/fuel-python` sind der echte lokale Prod-Stand
- `deploy.sh prod` liest **nicht** aus `~/fuel-dev`, sondern aus `~/.local/fuel`
- damit ist die Reihenfolge bewusst: erst Staging aktualisieren, dann Prod

Aktueller Desktop-Prod-Zustand:
- der laufende systemd-Entry-Point ist noch **v3** (`fuel.service`)
- v4 wird bereits nach `/opt/fuel-python` mitdeployt, ist aber noch nicht der aktive Prod-Service

### Firebase
Das Deployment nach Firebase erfolgt getrennt für die Cloud-Seite.

1.  **Manueller Build:** `fuelctl dev build`
2.  **Manueller Deploy:** `firebase deploy --only hosting`

### Firebase via GitHub Actions

Wichtig zur Zuständigkeit:
- `fuel-dev` ist die Dev-/localhost-Linie
- `vitalos/fuel-app` ist die Live-/Release-Linie für Firebase
- `vitalos/fuel-app` hat lokal weiter den aktiven `pre-push`-Hook, der auf
  `master` bei relevanten Änderungen automatisch `npm run firebase` ausführt
  und den Push bei Fehlern abbricht
- `fuel-release` stößt genau diesen Release-Pfad bequem von oben an

Die GitHub-Actions für Fuel bauen **nicht** in einem nackten Checkout dieses
Repos, sondern im `vitalos`-Meta-Repo.

Ablauf:
- `fuel-dev` Workflow checkt `nimmsel23/vitalos` aus
- Submodule werden initialisiert
- das Fuel-Submodule wird im Meta-Repo unter `fuel-app/` auf den ausgelösten
  Commit gesetzt
- gebaut wird dann per `npm run build:firebase --workspace=fuel-app`

Wichtige Pfade im CI:
- Fuel-Repo liegt im Meta-Repo unter `fuel-app/`, nicht unter `fuel-dev/`
- Fitness-Repo liegt dort unter `fitness-app/`
- Journal-Repo liegt dort unter `journal-app/`

Wichtige Build-Abhängigkeit:
- Vor dem Fuel-Firebase-Build muss `npm run build:kb-data --workspace=fitness-app`
  laufen
- Grund: Fuel importiert Fitness-KB-Code, der Generated-Dateien wie
  `src/lib/db/firestore/exerciseBulkData.generated.js` benötigt

Wenn der Fuel-CI-Build also mit fehlenden Fitness-Generated-Dateien scheitert,
ist zuerst zu prüfen, ob der Workflow `fitness-app build:kb-data` vor dem
eigentlichen Fuel-Build ausführt.

### Verifizierte CI-Fehlerbilder

Die folgenden Fehler sind bereits konkret in GitHub Actions aufgetreten und
nicht nur theoretische Risiken:

1. **Falscher Fuel-Pfad im Meta-Repo**
   - Fehlerbild: `cd: fuel-dev: No such file or directory`
   - Ursache: Der Workflow lief im `vitalos`-Meta-Repo, dort heißt das
     Submodule aber `fuel-app/`, nicht `fuel-dev/`

2. **Falsche Repo-Pfade bei Firebase-Config im Meta-Repo**
   - Fehlerbild: `cp: cannot create regular file 'fitness-dev/firebase.config.js': No such file or directory`
   - Ursache: Im Meta-Repo wurden noch `fitness-dev/` und `journal-dev/`
     angesprochen, real heißen die Pfade dort `fitness-app/` und `journal-app/`

3. **Fehlende Fitness-Generated-Dateien beim Fuel-Build**
   - Fehlerbild: `Could not resolve "./exerciseBulkData.generated.js" from "../fitness-app/src/lib/db/firestore/kb.js"`
   - Ursache: Fuel baut gegen Fitness-KB-Code, aber der Workflow hatte vorher
     `npm run build:kb-data --workspace=fitness-app` nicht ausgeführt

4. **Separater VitalOS-Shell-Build-Fehler**
   - Fehlerbild: `Could not load .../fitness-app/lib/muscleMap.js`
   - Kontext: das war **nicht** der Fuel-Workflow selbst, sondern der
     `vitalos`-Build
   - Ursache: Es fehlte der Alias `@fitness/lib` in
     `vitalos/packages/cross-app-aliases/index.mjs`

Diese vier Punkte sind die bisher real verifizierten CI-Bruchstellen vom
23. August 2026. Weitere Fehler sollten immer wieder direkt aus den aktuellen
GH-Run-Logs abgeleitet werden, statt neue Ursachen zu raten.

---

## 4. System-Steuerung (`fuelctl`)

Das Tool `fuelctl` dient als Master-Controller für die lokale Umgebung.

- **`fuelctl status`**: Zeigt den Zustand der lokalen Runtime-Schichten und des Sync-Watchers an.
- **`fuelctl dev up`**: Startet die lokale Runtime.
- **`fuelctl sync`**: Manueller Datenabgleich für die Cloud-/Firestore-Seite.

## 5. What Could Possibly Go Wrong

- `deploy.sh prod` wird direkt gegen `~/fuel-dev` gedacht, obwohl es aus
  `~/.local/fuel` liest
- `~/.local/fuel` wird für den Live-Prod-Stand gehalten
- `fuel-devctl` und `fuel-prodctl` werden verwechselt
- `fuel-release` wird mit einem lokalen Desktop-Deploy verwechselt
- Cross-Repo-Builds brechen, wenn `@vos/cross-app-aliases` oder die Meta-Repo-
  Pfade implizit verändert werden

## 6. Nicht Verändern

- die zweistufige Kette `~/fuel-dev -> ~/.local/fuel -> /opt/fuel`
- die Rollenverteilung `fuel-devctl` / `fuel-prodctl` / `fuelctl`
- `@vos/cross-app-aliases` als SSOT für Cross-Repo-Auflösung
- die Trennung zwischen localhost-Deploy und Firebase-Release
