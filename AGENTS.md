# AGENTS.md — Fuel Dev

> **Python-Paket `fuel` (2026-11-10):** SOT `~/dev/coach-dev/backend/fuel/` (CLI+API). Kein `fuel/`-Package mehr in diesem Repo — siehe `docs/PYTHON-PACKAGE-MOVED.md`. `FUEL_REPO_DIR` default = dieses Checkout (catalogs/).

**Simplicity (Owner 2026-11-11):** So simpel wie möglich. Ausnahme nur
`vitalos/prod` — dieses `*-dev`-Repo nicht mit Prod-Komplexität aufblasen.
Fleet-SOT: `.dotfiles/docs/CI.md` (Kopf).

## Repo- und Branch-Rollen

- Dieses Repo ist die Entwicklungsquelle für die eigenständige Fuel-App. `dev` ist der Entwicklungsbranch; Qualifizierende Änderungen auf `dev` starten den CI-Preview-Deploy (siehe Pfadfilter in `preview-dev.yml`).
- In diesem Repo deployed aktuell `master` die eigenständige Fuel-App live (`.github/workflows/deploy-master.yml`). Produktionsbranch der Standalone-App und Shell-Pin-Quelle ist `master`.
- Im Meta-Repo `~/vitalos` liegt dieses Repo als Submodule `fuel-app`. Der Checkout liefert Quellcode für die Fuel-Subapps der VitalOS-Shell; der Meta-Repo-Gitlink pinnt dafür einen konkreten Commit. `branch = master` in `.gitmodules` steuert `git submodule update --remote`, verschiebt aber den gespeicherten Gitlink nicht automatisch.
- `~/vitalos` selbst ist die VitalOS-Shell. Ihr Produktionsbranch ist `master`; die Shell-CI deployed die Shell samt den dort gepinnten Submodule-Quellen.
- Ein Branch-Push auf `dev` oder `master` aktualisiert den Submodule-Gitlink im Meta-Repo nicht automatisch. Für einen neuen Shell-Quellstand muss der Pointer in `~/vitalos` aktualisiert werden.
- `main` ist für diesen Ablauf nicht erforderlich. Branch-Namen und Ziele immer anhand des aktiven Workflows prüfen.

## Ausgelagerte Teile (Stand 2026-11-04)

Aus diesem Repo sind zwei Bereiche in eigene Repos gewandert. Dort arbeiten, nicht hier neu anlegen:

| Was | Neuer Ort | Remote (privat) | Hinweis |
|---|---|---|---|
| Node-Backend (Fastify, Firestore-Sync, Push): ehemals `server.mjs`, `src/server/`, `scripts/{sync-daemon,firestore-sync,coach-task,backfill-micro-keys,test-push-local,migrate-data}.mjs`, Server-Tests | `~/dev/backend/fuel` | Teil von `~/dev/backend` (ehem. `nimmsel23/fuel-backend`) | Verlauf von `src/server` erhalten (git subtree split). Layout wie im Deploy-Ziel (`server.mjs`, `src/server/`, `scripts/`). `src/shared` SOT liegt dort (echte Dateien). Frontend: relative Imports auf `src/shared/`-Stubs (Re-Export zur SOT, kein Ordner-Symlink). Katalog/dist/`.env` aus diesem Repo (oder `FUEL_ROOT`). |
| Alter Frontend-Zweig `frontend/` (pausierter Refactor, `fuel-centre` 4.0) | `~/dev/fuel-frontend` | `nimmsel23/fuel-frontend` | Mit Verlauf herausgelöst, Server-Code (`src/server`) und Server-Deps entfernt. Das Root-Frontend dieses Repos (`src/client`) ist weiter. |

Folgen:
- Die Server-Dependencies (`fastify`, `@fastify/*`, `firebase-admin`, `web-push`, `better-sqlite3`, `pino`, `yaml`) stehen nicht mehr in der `package.json` dieses Repos (und damit nicht in den Lockfiles von `~/vitalos`), nur noch in `backend/fuel/package.json` und `deploy/runtime/package.json` (Deploy-Manifest).
- `deploy.sh` liest das Backend fürs Staging aus `$FUEL_BACKEND_DIR` (Standard `~/dev/backend/fuel`, muss neben diesem Repo ausgecheckt sein); Prod kopiert weiter aus dem flachen Staging-Stand `~/.local/fuel`.
- `package.json`-Skripte `start`/`dev`/`cloud:*`, `scripts/dev-runner.mjs` und `bin/fuelctl` zeigen auf `../backend/fuel`. Python: `~/dev/backend/fuel/backend` (`fuel-devctl`); `api/main.py` liest Frontend-`dist` aus `../fuel-frontend/dist` oder `FUEL_FRONTEND_DIR`.
- Neue Server-Änderungen (Routen, Services, Firestore-Admin) gehören nach `~/dev/backend/fuel`, nicht hierher.


## Python-`backend/` (Stand 2026-11-09)

SOT: `~/dev/backend/fuel/backend`. Kein Symlink in diesem Repo.
`fuel-devctl` → `FUEL_PYTHON_BACKEND_DIR` / Default `../backend/fuel/backend`.
Siehe `docs/BACKEND-MOVED.md`.


## Fuel-Mini-Apps: Release-Grenze

- `vos-fuel-log`, `vos-fuel-supplements`, `vos-fuel-mikros` und `vos-fuel-protokoll` sind stabile Fallback-Apps. Sie gehören nicht zum automatischen `fuel-release`.
- Ein Fuel-Release darf nur den `fuel-app`-Pointer aktualisieren und die Hosting-Site `client` deployen. Mini-App-Pointer bleiben unverändert.
- Mini-Apps werden nur auf ausdrückliche manuelle Auswahl mit `pnpm run deploy:solo:<log|supplements|mikros|protokoll>` veröffentlicht.

<!-- release-weg:start -->
## Release-Weg und Branches (Fuel)

Stand 2026-11-09. Ausführlich: `~/vitalos/docs/DEPLOYMENT.md`.

**dev → master** (+ Shell-Pin auf `origin/master`)

| Branch | Rolle | Lokal |
|---|---|---|
| `dev` | Edits und Previews (Preview-Channel `dev`, PR-Channel je PR) | ja — dieser Klon steht fest auf `dev` |
| `master` | **Standalone-Prod** (Hosting-Target `client` = fuel-vos.web.app (die Fuel-Mini-Apps `vos-fuel-*` laufen nie per CI, nur manuell)); deployt nur per CI (`Live Deploy (Fuel master)`) | nein, lokal nicht nötig |
| `vitalos` | **Legacy** (darf remote noch existieren) — kein Pin-Ziel mehr | nicht für Shell nutzen |

- Release (automatisch): `dev` committen und pushen. Nach grünem Check promotet `automerge.yml` nach `master` und startet den Live-Deploy. Direkte Pushes auf `master` vermeiden; Hotfixes über `dev`.
- Shell: `vos-release` / `vos-ship` pinnt `origin/master` (detached im `*-app`) und bumpt den Meta-Pointer → `deploy-shell.yml`. Vorher `vos-overview`.
- `.gitmodules` im Meta-Repo: `branch = master`. Kein Auto-Vorspulen eines App-Branches `vitalos` mehr.
- Parallel-Branches/Worktrees nur mit Owner-Ausnahme.
- Default-Branch des Repos ist `master`; die Workflows auf `master` bestimmen das Live-Verhalten.
<!-- release-weg:end -->

## Vite 8 / Rolldown

`vite.config.js` und `vite.config.cjs` enthalten `fixRolldownPreloadMarker`.
Rolldown hängt sonst an `__VITE_PRELOAD__` einen Hash; Vite ersetzt nur die Marke
und lässt `[]<hash>` im Bundle (SyntaxError → Blackscreen, wie bei
`vos-6pack.web.app`). Plugin nicht entfernen — Capacitor-Deps sind da und werden
Lazy-`import('./web')` ins Web-Bundle ziehen.
