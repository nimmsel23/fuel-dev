# AGENTS.md — Fuel Dev

## Repo- und Branch-Rollen

- Dieses Repo ist die Entwicklungsquelle für die eigenständige Fuel-App. `dev` ist der Entwicklungsbranch; Qualifizierende Änderungen auf `dev` starten den CI-Preview-Deploy (siehe Pfadfilter in `preview-dev.yml`).
- In diesem Repo deployed aktuell `master` die eigenständige Fuel-App live (`.github/workflows/deploy-master.yml`). `vitalos` bezeichnet die Produktionsumgebung, ist bei Fuel aber nicht der Name des Produktions-Branches.
- Im Meta-Repo `~/vitalos` liegt dieses Repo als Submodule `fuel-app`. Der Checkout liefert Quellcode für die Fuel-Subapps der VitalOS-Shell; der Meta-Repo-Gitlink pinnt dafür einen konkreten Commit. `branch = vitalos` in `.gitmodules` steuert `git submodule update --remote`, verschiebt aber den gespeicherten Gitlink nicht automatisch.
- `~/vitalos` selbst ist die VitalOS-Shell. Ihr Produktionsbranch ist `master`; die Shell-CI deployed die Shell samt den dort gepinnten Submodule-Quellen.
- Ein Branch-Push auf `dev` oder `master` aktualisiert den Submodule-Gitlink im Meta-Repo nicht automatisch. Für einen neuen Shell-Quellstand muss der Pointer in `~/vitalos` aktualisiert werden.
- `main` ist für diesen Ablauf nicht erforderlich. Branch-Namen und Ziele immer anhand des aktiven Workflows prüfen.

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
