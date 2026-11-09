# AGENTS.md — Fuel Dev

## Repo- und Branch-Rollen

- Dieses Repo ist die Entwicklungsquelle für die eigenständige Fuel-App. `dev` ist der Entwicklungsbranch; Qualifizierende Änderungen auf `dev` starten den CI-Preview-Deploy (siehe Pfadfilter in `preview-dev.yml`).
- In diesem Repo deployed aktuell `master` die eigenständige Fuel-App live (`.github/workflows/deploy-master.yml`). `vitalos` bezeichnet die Produktionsumgebung, ist bei Fuel aber nicht der Name des Produktions-Branches.
- Im Meta-Repo `~/vitalos` liegt dieses Repo als Submodule `fuel-app`. Der Checkout liefert Quellcode für die Fuel-Subapps der VitalOS-Shell; der Meta-Repo-Gitlink pinnt dafür einen konkreten Commit. `branch = vitalos` in `.gitmodules` steuert `git submodule update --remote`, verschiebt aber den gespeicherten Gitlink nicht automatisch.
- `~/vitalos` selbst ist die VitalOS-Shell. Ihr Produktionsbranch ist `master`; die Shell-CI deployed die Shell samt den dort gepinnten Submodule-Quellen.
- Ein Branch-Push auf `dev` oder `master` aktualisiert den Submodule-Gitlink im Meta-Repo nicht automatisch. Für einen neuen Shell-Quellstand muss der Pointer in `~/vitalos` aktualisiert werden.
- `main` ist für diesen Ablauf nicht erforderlich. Branch-Namen und Ziele immer anhand des aktiven Workflows prüfen.

## Ausgelagerte Teile (Stand 2026-11-04)

Aus diesem Repo sind zwei Bereiche in eigene Repos gewandert. Dort arbeiten, nicht hier neu anlegen:

| Was | Neuer Ort | Remote (privat) | Hinweis |
|---|---|---|---|
| Node-Backend (Fastify, Firestore-Sync, Push): ehemals `server.mjs`, `src/server/`, `scripts/{sync-daemon,firestore-sync,coach-task,backfill-micro-keys,test-push-local,migrate-data}.mjs`, Server-Tests | `~/dev/backend/fuel` | (im Repo `nimmsel23/fitness-backend` / `~/dev/backend`) | Verlauf von `src/server` erhalten (git subtree split). Layout wie im Deploy-Ziel (`server.mjs`, `src/server/`, `scripts/`). `src/shared` ist dort ein Symlink auf `../fuel-dev/src/shared`; Katalog/dist/`.env` kommen aus diesem Repo (oder `FUEL_ROOT`). |
| Alter Frontend-Zweig `frontend/` (pausierter Refactor, `fuel-centre` 4.0) | `~/dev/fuel-frontend` | `nimmsel23/fuel-frontend` | Mit Verlauf herausgelöst, Server-Code (`src/server`) und Server-Deps entfernt. Das Root-Frontend dieses Repos (`src/client`) ist weiter. |

Folgen:
- Die Server-Dependencies (`fastify`, `@fastify/*`, `firebase-admin`, `web-push`, `better-sqlite3`, `pino`, `yaml`) stehen nicht mehr in der `package.json` dieses Repos (und damit nicht in den Lockfiles von `~/vitalos`), nur noch in `backend/fuel/package.json` und `deploy/runtime/package.json` (Deploy-Manifest).
- `deploy.sh` liest das Backend fürs Staging aus `$FUEL_BACKEND_DIR` (Standard `~/dev/backend/fuel`, muss neben diesem Repo ausgecheckt sein); Prod kopiert weiter aus dem flachen Staging-Stand `~/.local/fuel`.
- `package.json`-Skripte `start`/`dev`/`cloud:*`, `scripts/dev-runner.mjs` und `bin/fuelctl` zeigen auf `../backend/fuel`. `backend/api/main.py` (Python) liest das Frontend-`dist` aus `../fuel-frontend/dist` oder `FUEL_FRONTEND_DIR`.
- Neue Server-Änderungen (Routen, Services, Firestore-Admin) gehören nach `~/dev/backend/fuel`, nicht hierher.

## Fuel-Mini-Apps: Release-Grenze

- `vos-fuel-log`, `vos-fuel-supplements`, `vos-fuel-mikros` und `vos-fuel-protokoll` sind stabile Fallback-Apps. Sie gehören nicht zum automatischen `fuel-release`.
- Ein Fuel-Release darf nur den `fuel-app`-Pointer aktualisieren und die Hosting-Site `client` deployen. Mini-App-Pointer bleiben unverändert.
- Mini-Apps werden nur auf ausdrückliche manuelle Auswahl mit `pnpm run deploy:solo:<log|supplements|mikros|protokoll>` veröffentlicht.

<!-- release-weg:start -->
## Release-Weg und Branches (Fuel)

Stand 2026-10-29. Ausführlich: `~/vitalos/docs/DEPLOYMENT.md` (GitHub: nimmsel23/vitalos, `docs/DEPLOYMENT.md`).

**dev → master → vitalos**

| Branch | Rolle | Lokal |
|---|---|---|
| `dev` | Edits und Previews (Preview-Channel `dev`, PR-Channel je PR) | ja — dieser Klon steht fest auf `dev` |
| `master` | **Standalone-Prod** (Hosting-Target `client` = fuel-vos.web.app (die Fuel-Mini-Apps `vos-fuel-*` laufen nie per CI, nur manuell)); deployt nur per CI (`Live Deploy (Fuel master)`) | nein, muss nicht existieren |
| `vitalos` | Stand für die Shell (`~/vitalos/fuel-app`); darf hinter `master` liegen | nur als `-app`-Checkout im Meta-Repo |

- Release: `vos-release-pr fuel` öffnet den PR `dev → master`. `Check (Fuel)` läuft, bei Grün mergt der Auto-Merge
  (Merge-Commit) und startet den Live-Deploy per Dispatch. Nie von Hand auf `master` pushen, außer Hotfix.
- Shell: `vos-release fuel` merged `origin/master` nach `vitalos` und bumpt den Pointer im Meta-Repo (deployt die Shell).
  Vorher `vos-overview`.
- `master` wird nie lokal ausgecheckt; `git fetch` genügt. Das Meta-Repo `vitalos` deployt nur noch die Shell.
- Nicht auf `dev` im Hauptordner arbeiten, wenn ein Agent-/Feature-Branch nötig ist: Worktree
  (`git worktree add .worktrees/<name> <branch>`).
- Default-Branch des Repos ist `master`; die `.github/workflows/*.yml` auf `master` bestimmen das Live-Verhalten.
<!-- release-weg:end -->

## Org-Taskwarrior (global) — gilt fuer alle Agenten der VitalOS-Org

Verbindlich fuer alle Agenten (Vibe, Claude, Codex, Gemini) in Org-Kontexten
(Owner-Weisung 2026-11-07):

1. EINE globale Org-Task-DB — KEINE eigenen Rollen- oder Repo-DBs mehr:
   `TASKRC=~/.local/state/vitalos-org/taskrc` (DB liegt daneben in `task/`).
   Alte Repo-DBs sind archiviert unter `~/.local/state/vitalos-org/archive-repodb/`.
2. Daniels private Taskwarrior-DB (`~/.task`, u. a. Hotlist `+hot`) bleibt
   TABU fuer Schreibzugriffe — nur lesend (CEO-Runde: Task `status:pending +hot`).
3. Rolle = Tag: Jeder Agent taggt seine eigenen Aufgaben mit seiner Rolle:
   `+ceo`, `+cto`, `+al`, `+pm`, `+alpha`, `+betta` …
4. Abteilung/Repo = project: `project:fitness-dev`, `project:journal-dev`,
   `project:vitalos-prod`, `project:dotfiles`, `project:aos` …
5. Prio-Encoder (in der Org-taskrc verankert):
   - `+hit` und `+br` sind EIN Tier (Hits = Big Rocks, Koeffizient 8.0) —
     hoechste Dringlichkeit, `+hit` = `+br`.
   - `+lr` 2.0 (Little Rocks).
   - `+hot` 1.0 — NUR Potential/Sichtbarkeit, wird NIE automatisch ausgefuehrt;
     ob ein Potential jetzt anfaellt, entscheidet der Door War (Sonntagsrunde).
   - `+s` -1.0 (Sand, Zeitverschwendungsroutine).
   - `+go` ist KEINE Prioritaet und bewirkt nichts — Freigaben laufen ueber
     die Rollen (CTO-Freigabeprozess), nicht ueber Urgency.
6. Aufgaben IMMER per UUID anfassen (`task <uuid> modify|done|info`), NIE per
   ID — IDs renummerieren sich nach jedem `done` (Fehltreffer-Gefahr).
7. Guard: orgsh und die Runner verweigern den Lauf, wenn die Org-taskrc fehlt —
   kein stiller Rueckfall auf die Privat-DB.
8. Uebersicht/Rang: `TASKRC=~/.local/state/vitalos-org/taskrc \
   ~/.org/venv/bin/python ~/aos/bin/aos door plan quadrants --json`
   (Eisenhower-Sicht Q1–Q4).
