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
- Doku-Dateien (`.md`, `.bak`), `public/sw.js`, `public/manifest.json` und
  `dist-firebase/` selbst zählen **nicht** als Deploy-Grund — das sind
  Build-Output des vorherigen Laufs, sonst triggert sich der Hook bei jedem
  Push auf sich selbst (endlose Bump-Spirale ohne echten Inhalt)
- `npm run firebase` = `build:firebase` (`npm run bump:sw` — bumpt
  `public/sw.js` Cache-Version + `public/manifest.json` `version`-Feld via
  `scripts/bump-sw.mjs`, dann `build:cloud`) gefolgt von `deploy:firebase`
  (`firebase deploy --only hosting --project fitness-aos`)
  - ⚠️ **Anders als fitness-dev:** fuel-dev nutzt `vite-plugin-pwa` im
    `generateSW`-Modus (`vite.config.cjs`). Der Service Worker wird beim
    Build komplett automatisch von Workbox generiert und überschreibt
    `public/sw.js` vollständig — der manuell gebumpte `CACHE`-String landet
    nie im Deploy. Der `bump:sw`-Schritt läuft trotzdem mit (harmlos, kostet
    nur den `manifest.json` `version`-Bump, der tatsächlich greift), ist für
    das SW-Caching selbst aber wirkungslos. fitness-dev managt `public/sw.js`
    dagegen manuell als statisches Asset (kein `vite-plugin-pwa`) — dort
    bumpt der Wert wirklich das ausgelieferte Cache-Verhalten.
- Schlägt der Build/Deploy fehl, wird der Push abgebrochen (kein halb-deployter
  Stand) — Override mit `git push --no-verify`
- sw.js/manifest.json-Bump passiert lokal nach dem Push und ist **nicht**
  automatisch Teil des gepushten Commits — separat committen falls gewünscht
  (der Bump-Commit selbst löst beim nächsten Push keinen erneuten Deploy aus,
  s.o. — erst ein echter `src/`/`public/`-Inhaltswechsel tut das wieder)
