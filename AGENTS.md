# AGENTS.md — Fuel Dev

## Repo- und Branch-Rollen

- Dieses Repo ist die Entwicklungsquelle für die eigenständige Fuel-App. `dev` ist der Entwicklungsbranch; Qualifizierende Änderungen auf `dev` starten den CI-Preview-Deploy (siehe Pfadfilter in `preview-dev.yml`).
- In diesem Repo deployed aktuell `master` die eigenständige Fuel-App live (`.github/workflows/deploy-master.yml`). `vitalos` bezeichnet die Produktionsumgebung, ist bei Fuel aber nicht der Name des Produktions-Branches.
- Im Meta-Repo `~/vitalos` liegt dieses Repo als Submodule `fuel-app`. Der Checkout liefert Quellcode für die Fuel-Subapps der VitalOS-Shell; der Meta-Repo-Gitlink pinnt dafür einen konkreten Commit. `branch = vitalos` in `.gitmodules` steuert `git submodule update --remote`, verschiebt aber den gespeicherten Gitlink nicht automatisch.
- `~/vitalos` selbst ist die VitalOS-Shell. Ihr Produktionsbranch ist `master`; die Shell-CI deployed die Shell samt den dort gepinnten Submodule-Quellen.
- Ein Branch-Push auf `dev` oder `master` aktualisiert den Submodule-Gitlink im Meta-Repo nicht automatisch. Für einen neuen Shell-Quellstand muss der Pointer in `~/vitalos` aktualisiert werden.
- `main` ist für diesen Ablauf nicht erforderlich. Branch-Namen und Ziele immer anhand des aktiven Workflows prüfen.
