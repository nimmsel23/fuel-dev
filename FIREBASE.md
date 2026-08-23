# Fuel Centre — Firebase

Diese Datei beschreibt nur das, worauf es beim Firebase-Deployment von Fuel
real ankommt.

## 1. Die reale Trennung der Firebase-Linien

Es gibt aktuell zwei relevante Linien mit unterschiedlicher Verantwortung:

### `fuel-dev`

- Branch `dev`
- Dev-Checkout
- Quelle für lokale Desktop-Deploys
- Ausgangspunkt für Änderungen, die später in den Release-Pfad weitergereicht werden

### `vitalos/fuel-app`

- Branch `master`
- Live-Deploy nach Firebase per lokalem Git-Hook
- `core.hooksPath=.githooks`
- `.githooks/pre-push` führt bei relevanten Änderungen auf `master`
  automatisch `npm run firebase` aus
- Fehlschlag bricht den Push ab
- der Top-Level-Wrapper dafür ist `fuel-release`

Kurz:
- `fuel-dev` = Dev + localhost
- `fuel-app` = Live/Release

## 2. Zwei verschiedene Deploy-Wege

### Lokal manuell

Direkt im Fuel-Repo:

```bash
npm run build:firebase
firebase deploy --only hosting --project fitness-aos
```

Oder äquivalent:

```bash
npm run firebase
```

Das ist der lokale direkte Hosting-Deploy aus `~/fuel-dev`.

Für den eigentlichen Release-Flow ist aber vor allem `vitalos/fuel-app` auf
`master` relevant, weil dort der Live-Deploy per `pre-push`-Hook hängt.

Der bequeme Wrapper dafür ist:

```bash
fuel-release
```

### GitHub Actions

Die CI baut Fuel **nicht** in einem nackten Checkout von `fuel-dev`, sondern
im `vitalos`-Meta-Repo.

Der entscheidende Ablauf ist:

1. `fuel-dev`-Workflow checkt `nimmsel23/vitalos` aus
2. Submodule werden initialisiert
3. das Fuel-Submodule wird im Meta-Repo auf den ausgelösten Commit gesetzt
4. gebaut wird per Workspace im Meta-Repo
5. deployt wird aus dem Fuel-Submodule heraus nach Firebase Hosting

## 3. Die Pfade, auf die es wirklich ankommt

Im Meta-Repo heißen die Verzeichnisse:

- Fuel: `fuel-app/`
- Fitness: `fitness-app/`
- Journal: `journal-app/`

Nicht korrekt für die CI in diesem Kontext sind:

- `fuel-dev/`
- `fitness-dev/`
- `journal-dev/`

Das ist der wichtigste Punkt. Ein großer Teil der gebrochenen CI kam genau aus
dieser Verwechslung zwischen Home-Checkout-Namen und Meta-Repo-Pfaden.

## 4. Der eigentliche Fuel-Build in CI

Der relevante Build-Schritt ist:

```bash
npm run build:firebase --workspace=fuel-app
```

Nicht:

```bash
npm run build:firebase --workspace=fuel-dev
```

## 5. Versteckte harte Abhängigkeit: Fitness-KB

Fuel baut in Firebase nicht vollständig isoliert. Der Fuel-Cloud-Build zieht
Fitness-Code mit hinein, insbesondere KB-/Firestore-Code.

Darum muss **vor** dem Fuel-Build laufen:

```bash
npm run build:kb-data --workspace=fitness-app
```

Sonst fehlen Generated-Dateien wie:

- `fitness-app/src/lib/db/firestore/exerciseBulkData.generated.js`

Typisches Fehlerbild ohne diesen Schritt:

```text
Could not resolve "./exerciseBulkData.generated.js" from "../fitness-app/src/lib/db/firestore/kb.js"
```

## 6. Verifizierte CI-Fehler vom 23. August 2026

Diese Fehler sind tatsächlich in GitHub Actions aufgetreten:

### Falscher Fuel-Pfad

Fehler:

```text
cd: fuel-dev: No such file or directory
```

Ursache:
- Workflow lief im `vitalos`-Meta-Repo
- dort heißt das Fuel-Submodule `fuel-app/`

### Falsche Firebase-Config-Pfade

Fehler:

```text
cp: cannot create regular file 'fitness-dev/firebase.config.js': No such file or directory
```

Ursache:
- Workflow schrieb noch in `fitness-dev/` und `journal-dev/`
- korrekt im Meta-Repo sind `fitness-app/` und `journal-app/`

### Fehlender Fitness-KB-Generate-Schritt

Fehler:

```text
Could not resolve "./exerciseBulkData.generated.js" from "../fitness-app/src/lib/db/firestore/kb.js"
```

Ursache:
- `fitness-app build:kb-data` lief vor dem Fuel-Build nicht

## 7. Separater, aber verwandter VitalOS-Fehler

Zusätzlich trat im `vitalos`-Build ein anderer Fehler auf:

```text
Could not load .../fitness-app/lib/muscleMap.js
```

Das war nicht der Fuel-Workflow selbst, aber dieselbe Meta-Repo-/Alias-Zone.

Ursache:
- in `vitalos/packages/cross-app-aliases/index.mjs` fehlte `@fitness/lib`

## 8. Kurzfassung

Wenn Firebase/CI für Fuel bricht, zuerst genau diese Punkte prüfen:

1. Läuft der Workflow im `vitalos`-Meta-Repo?
2. Nutzt er dort `fuel-app/`, `fitness-app/`, `journal-app/`?
3. Baut er `fitness-app build:kb-data` vor dem Fuel-Build?
4. Baut er Fuel über `--workspace=fuel-app`?
5. Ist klar getrennt, ob gerade die Dev-/localhost-Linie (`fuel-dev`) oder die
   Live-Linie (`vitalos/fuel-app`) gemeint ist?
6. Ist bei Shell-/Meta-Repo-Builds der Alias `@fitness/lib` vorhanden?
7. Ist für den eigentlichen Release-Pfad `fuel-release` bzw. der Push in
   `vitalos/fuel-app` gemeint statt irgendein CI-Preview-Lauf?

Alles Weitere erst danach.

## 9. What Could Possibly Go Wrong

- `fuel-dev` und `vitalos/fuel-app` werden gedanklich vermischt
- im Meta-Repo werden versehentlich `fuel-dev/`, `fitness-dev/` oder
  `journal-dev/` statt `fuel-app/`, `fitness-app/`, `journal-app/` verwendet
- `fitness-app build:kb-data` fehlt vor dem Fuel-Build
- man hält einen CI-Preview-Lauf für den eigentlichen Live-Release
- der Release wird am `pre-push`-Hook von `vitalos/fuel-app` vorbei organisiert

## 10. Nicht Verändern

Die folgenden Invarianten sind Teil des funktionierenden Release-Pfads und
sollten nicht leichtfertig umgebaut werden:

- `@vos/cross-app-aliases` als SSOT für Cross-Repo-Aliase
- die Trennung `fuel-dev` = Dev/localhost und `vitalos/fuel-app` = Live/Release
- der Meta-Repo-Pfad `fuel-app/` statt Home-Checkout-Namen im CI
- `fitness-app build:kb-data` als Vorbedingung des Fuel-Firebase-Builds
- `core.hooksPath=.githooks` plus `pre-push`-Deploy in `vitalos/fuel-app`
