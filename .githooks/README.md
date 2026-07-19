# Git Hooks

Versionierte Git Hooks für dieses Repo. Nach einem frischen Clone aktivieren:

```bash
git config core.hooksPath .githooks
```

## Hooks

### post-commit
**Retired (2026-07-12), jetzt No-Op.** Deployte früher bei jedem Commit auf
`master` — das war zu früh für mehrstufige lokale Arbeit. Deploy-Trigger ist
jetzt `pre-push` (s.u.). Datei bleibt als Stub liegen statt gelöscht zu werden,
damit ein aktives `core.hooksPath` nicht versehentlich die alte
Doppel-Deploy-Logik reaktiviert.

### pre-push
Baut + deployt zu Firebase (`npm run firebase`) wenn ein Push auf `master`
relevante Dateien enthält (`src/`, `public/`, `index.html`, `vite.config*`,
`package.json`, `firebase.json`, `firestore.rules`).

- Trigger nur auf `master`, prüft alle gepushten Refs von stdin
- Vergleicht `remote_sha..local_sha` (bzw. den ganzen Branch bei neuem Remote-Ref)
- Doku-Dateien (`.md`, `.bak`) und `dist-firebase/` selbst zählen **nicht** als
  Deploy-Grund — das ist Build-Output, sonst triggert sich der Hook bei jedem
  Push auf sich selbst
- `npm run firebase` = `build:firebase` (`build:cloud`, dann
  `npm run stamp:sw` via `scripts/stamp-sw.mjs`) gefolgt von `deploy:firebase`
  (`firebase deploy --only hosting --project fitness-aos`)
  - **Seit 2026-07-19:** `stamp-sw.mjs` schreibt die Cache-Busting-Version
    (Zeitstempel, Base36) erst **nach** dem Build direkt in
    `dist-firebase/sw.js` + `dist-firebase/manifest.json` — nie mehr in die
    getrackten Quelldateien unter `public/`. Vorher (`bump-sw.mjs`) mutierte
    das Script `public/sw.js`/`public/manifest.json` selbst, was nach jedem
    Deploy einen manuellen Extra-Commit für die reine Versionszahl erzwang
    (Merge-Rauschen zwischen `dev`/`master`). `public/sw.js` trägt jetzt
    dauerhaft den Platzhalter `fuel-v0`, der nie committed geändert wird.
  - `public/sw.js` wird unverändert als statisches Asset kopiert — kein
    `vite-plugin-pwa` in `vite.config.cjs` aktiv (Dependency ist installiert,
    aber nicht als Plugin eingebunden), der Stempel greift also tatsächlich.
- Schlägt der Build/Deploy fehl, wird der Push abgebrochen (kein halb-deployter
  Stand) — Override mit `git push --no-verify`
