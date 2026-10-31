# Prod-Sync ohne Mehrfach-Pushes, Deploy-Reparatur und Staging-Service (2026-10-29)

Auslöser: Der User hat `fuel.service` (:7000) nach längerer Pause wieder als Systemdienst gestartet. Beim Prüfen des Stunden-Syncs fielen Mehrfach-Pushes desselben Tages auf (z. B. `2026-07-31` 6×, `2026-08-23` 10× in 10 min) — erst als „harmlos" eingestuft, vom User zu Recht zurückgewiesen. Dev-Arbeit trotz überfälliger Taskwarrior-Tasks auf ausdrücklichen Auftrag des Users. Alles auf `dev` committet; Prod-Deploys hat der User selbst ausgeführt (kein sudo durch Claude).

- **`src/server/services/nutrition-db.mjs`, `src/server/lib/firestore-admin.mjs`** (`a5ae95e`): Ursache der Mehrfach-Pushes war der stündliche Pull — jedes per `upsertMeal`/`upsertWater` lokal geschriebene Dokument löste einen Fire-and-forget-`pushNutritionLog` des ganzen Tages aus (N Meals → N+1 Pushes derselben Daten). Neue Option `skipPush`, vom Pull-Pfad gesetzt; gezielter Pushback bei `changed`/Tombstones und alle normalen App-Schreibvorgänge pushen unverändert.
- **`tests/nutrition-db-skip-push.test.mjs`** (neu): mit `skipPush` 3 Meals + Wasser lokal, 0 Pushes; ohne `skipPush` weiter 1 Push je Write. Suite 111/111 grün.
- **`package.json`, `pnpm-lock.yaml`** (`f752c78`): `pino@9.14.0` als Abhängigkeit deklariert — `src/server/lib/logger.mjs` importierte es nur transitiv über fastify; unter pnpm (striktes Layout) `ERR_MODULE_NOT_FOUND` → `fuel.service` in der Absturzschleife. Import-Scan über `src/server`: keine weiteren ungedeklarierten Pakete.
- **`deploy.sh`** (`f752c78`): Prod-Sync von `/opt/fuel` löscht `node_modules` nicht mehr (`--exclude "node_modules"`); `fuel/` (Python-Shared-Paket, vom Backend per `fuel.omega3` importiert) wird jetzt nach `/opt/fuel-python/fuel` synchronisiert — vorher `ModuleNotFoundError` in `fuel-python.service`. Hintergrund: der erste Deploy (`pkexec fuel prod deploy`, lief als root) hatte beide Dienste in die Absturzschleife gebracht; nach dem Fix hat der User `./deploy.sh prod` als `alpha` wiederholt → `fuel.service` und `fuel-python.service` `active`, `/health` auf :7000 und :4000 ok, `skipPush` in `/opt/fuel` (3 Treffer), `node_modules` wieder da. Dabei wurde die v4-DB (`~/.aos/fuel/nutrition/nutrition.db`) per Alembic von `add_journal_text_frames_001` auf `supplement_catalog_notes_004` migriert.
- **`bin/fuelctl`** (`b73fd67`): `subprocess.run` an allen Delegationsstellen (dev, prod, cloud push/pull/watch, sync) ignorierte den Exit-Code → ein abgebrochener `fuel prod deploy` endete mit Exit 0. Neuer Helfer `delegate()` reicht den Code durch; unbekannte `dev`-/`cloud`-Aktionen enden mit 1. Geprüft: `fuel prod gibtsnicht` alt Exit 0, neu Exit 2; `fuel prod status`/`fuel status` weiter 0. `fuel-prodctl` selbst war korrekt.
- **`deploy.sh`, `.githooks/pre-push`, `src/server/app.mjs`** (`959543a`): `deploy.sh staging` baut nicht mehr neu, sondern übernimmt die vorhandene `dist/`/`frontend/dist/` (Abbruch mit Hinweis, wenn sie fehlen; `--build` für frischen Build), lässt `node_modules` beim rsync aus und führt im Stage-Ordner `pnpm install --frozen-lockfile --prod` aus. Legt/startet user-Unit `~/.config/systemd/user/fuel-preview.service` (`node server.mjs` aus `~/.local/fuel`, `127.0.0.1:8700`, `Restart=always`, analog `fitness-preview.service`); zweiter Lauf idempotent („Unit bereits aktuell"). Neuer Schalter `FUEL_DISABLE_PUSH_SCHEDULER=1` in `app.mjs` (von der Unit gesetzt), weil Staging denselben Datenordner `~/.aos/fuel` wie Prod nutzt und sonst doppelte Push-Erinnerungen schickte; Firestore-Sync ist bei Port ≠ 7000 ohnehin aus (Journal bestätigt). Pre-push-Kommentar angepasst.
- **Push `dev`**: `9970e5f..b73fd67` (6 Commits) gepusht; CI „Preview (Fuel dev)" (Run `40856833968`) und „Check (Fuel)" liefen grün, der Cloud-Preview kommt aus der CI, der Hook spiegelt nur nach `~/.local/fuel`. `959543a` kam danach und ist **nicht gepusht**.
- **Befunde (ohne Codeänderung)**: `fitness-firestore-daemon.service` ist `inactive`/`disabled` — damit ist `fuel.service` aktuell die einzige Sync-Engine, die CLAUDE.md-Aussage „überlappt für die Operator-UID" trifft derzeit nicht zu. `fuel.service` ist `disabled` (kein Autostart nach Reboot). v3 (`fuel.service`: Node, 0.0.0.0:7000, Firestore-Sync, Klienten, ~52 Routen) und v4 (`fuel-python.service`: FastAPI, 127.0.0.1:4000, kein Firestore, Single-User, ~33 Routen) zeigen auf denselben SQLite-Pfad, Tabellenkollisionen nicht geprüft. Beim Staging fiel die Wahl auf Node, weil Sync/Push/Supplements/Gemini nur dort existieren.
- NICHT getestet: ob die Mehrfach-Pushes im Prod-Betrieb wirklich weg sind (braucht den nächsten vollen Stunden-Sync + Journal-Auswertung); ein absichtlich scheiternder echter `fuel prod deploy` mit der neuen Exit-Code-Kette. Nicht angelegt: v4-Staging-Service (nur ~1,5 GB RAM frei). Untracked liegen noch Backups (`deploy.sh.bak`, `bin/fuelctl.bak`, `*.bak2`, `.github/workflows/*.bak*`).

---

# Töpfe- und Küche-Tab, Standalone-Build und CI-Umbau (2026-10-26)

Zwei neue Cloud-Tabs auf `dev` gebaut (Regel „kein Dev bei fälligen Tasks" vom User für diesen Auftrag ausdrücklich überstimmt, General's Tent gilt als obsolet), danach Review-Runde, Release und Umbau von Preview-/Master-CI, damit Fuel ohne Nachbar-Repos baut.

- **Töpfe-Tab** (`fae51cd`, `481cc33`, `cc55df9`): `views/Pots/` (`PotCard`, `PotForm`), `hooks/usePots.js`, `lib/potsLogic.js`, `lib/potsPersist.js`, `lib/db/firestore/pots.js` (Collection `users/{uid}/fuel_pots`, nur Cloud-Kanal). Topf mit Name, Zutaten, Gesamtmakros (optional per Vertex, Prompt zwingt „Gesamtmenge"); Tagesanteile ¼ ⅓ ½ ⅔ ¾, „Rest", freie %-Eingabe, Summe ≤ 100 %. Jeder Anteil wird zugleich als skalierte Mahlzeit ins Tages-Log geschrieben (`pot_id`, `pot_fraction`).
- **Töpfe, Review-Fixes**: Topf bearbeiten (Stift, `applyPotEdit`/`planRescale` ziehen geloggte Mahlzeiten nach); Löschen/Verschieben einer Topf-Mahlzeit in `LogView.jsx` und `HistoryView.jsx` gibt den Topf-Tag frei bzw. zieht ihn mit (`syncPotAfterMealChange`); „Rest"-Knopf zeigt den echten Rest, größere Touch-Ziele, verständliche Fehlertexte ohne Login/offline.
- **Küche-Tab** (`047b7c5`, `751e103`, per Fork gebaut): `views/Kitchen/`, `hooks/useKitchen.js`, `lib/kitchenLogic.js`, `lib/kitchenAi.js`, `lib/db/firestore/pantry.js`. Subtabs Einkauf (Bon-Foto/Freitext → Review-Liste → Vorrat + Verlauf, Einkaufszettel, KI-Empfehlungen, Aktionen aus selbst eingelesenen Prospekten – keine erfundenen Angebote) und Vorrat (Bestand, Ablauf-Hinweis, KI-Rezeptideen). Review-Fixes: Zettel→Vorrat über Review-Liste, atomarer Einkauf, Dublettenschutz für Bons, genauerer Namensabgleich, Pfand/Rabatt nie im Vorrat, Dezimalkomma/ungültige Daten, ±-Tap-Race, deutsche Fehlermeldungen.
- **Backup/Restore**: `lib/backupFormat.js`/`lib/cloudBackup.js` kennen jetzt `fuel-pot`, `fuel-pantry`, `fuel-receipt`, `fuel-shopping`, `fuel-deal`, `kitchen-settings` (Topf-Anteile werden validiert).
- **Tests**: `tests/pots-logic.test.mjs`, `tests/pots-persist.test.mjs`, `tests/kitchen-logic.test.mjs`, Roundtrip-Test in `tests/backup.test.mjs`; `pnpm run test:unit` 102/102 grün, `build:cloud` ok. Töpfe-Karte mit Fake-Daten headless (Thorium) gerendert und angesehen; Test-Harness wieder entfernt.
- **Release**: `fuel-release --yes` (vom User ausgelöst) hat `dev` gepusht und den `fuel-app`-Pointer in `vitalos` gebumpt; „Deploy Fuel PWA" lief grün, Töpfe und Küche sind auf fuel-vos.web.app ausgeliefert.
- **`~/vitalos/packages/mini-app-shell`**: schon vorhandene, uncommittete `stamp.mjs`-Änderung (`register.reloadWindowMs` wird bis ins Register-Snippet durchgereicht, `0` = nie automatisch neu laden) mit Test (25 Paket-Tests grün) und README-Eintrag committet (`7704bcb`, `635ea53`) und auf `master` gepusht. Kein Mini-App-Config nutzt die Option bisher.
- **`.github/workflows/preview-dev.yml`**: Preview-Lauf war seit 22.10. rot (privates `skills-dev` nicht klonbar). Erst nur Workspace-Submodule geklont (`9a22c35`, `8346f68`), dann komplett auf nackten `fuel-dev`-Checkout umgestellt (`1c6ff1f`); erster grüner Lauf seit 22.10., 24h-Preview-Channel `dev` (Target `client`) + Telegram.
- **Standalone-Umbau** (`1c6ff1f`): Journal-Tab (`JournalVos`) entfernt, `useSwipeToDismiss` als eigene Kopie in `src/client/hooks/`, toter `lib/db/index.js`/`@fitness-db`-Re-Export und alle Sibling-Aliase (`@habits`, `@journal`, `@fitness`, …) sowie `preserveSymlinks` aus `vite.config.js`/`vite.config.cjs` entfernt, Kommentar in `scripts/deploy-preview.mjs` angepasst. Geprüft in leerem Verzeichnis ohne Nachbarn (`pnpm install --frozen-lockfile && build:cloud && build:local`).
- **`vitalos`-Lockfile**: `pnpm-lock.yaml` verliert die `@vos/cross-app-aliases`-Einträge im `fuel-app`-Block (Commit `chore(lockfile)…`), danach `fuel-release` zu Ende gelaufen; „Deploy Fuel PWA" und „Deploy VitalOS Shell" zu `502481c` grün.
- **`.github/workflows/deploy-master.yml`** (`d9f0682`, `9970e5f`): nackter Checkout statt `vitalos`/Submodule, `target` gesetzt, Trigger um `vite.config.*`/`package.json`/`pnpm-lock.yaml` erweitert, Live-URL in der Telegram-Meldung korrigiert. Auf User-Wunsch (master → fuel-os) neues Hosting-Target `fuelos` → Site `fuel-os` in `.firebaserc` und `firebase.json` (gleicher Build-Ordner `dist-firebase`); `fuel-vos` bleibt bei der vitalos-Pipeline.
- **`CLAUDE.md`**: Abschnitte „Töpfe-Tab", „Küche-Tab", Standalone-Regel (keine Cross-Repo-Imports), Live-Sites `fuel-vos`/`fuel-os`/`fuelos-web`, sechs Hosting-Targets.
- NICHT getestet: Küche und Vertex-Aufrufe (Bon-Erkennung, Rezeptideen, Topf-Schätzung) und echte Firestore-Schreibzugriffe im Browser (Login nötig); `deploy-master.yml` ist nie live gelaufen (Push auf `master` steht aus). Nichts auf `master` gepusht.
- Befund `fuel-os`: `fuel-os.web.app` zeigt eine andere App („Fuel OS" mit Wochen-Planer, Ordner `~/vitalos/fuel-os/`, Branch `fuel-os-ernaehrungsplaene` ist schon in `vitalos`-`master` gemergt, zuletzt deployt 23.10.) — der erste `master`-Deploy aus `fuel-dev` würde sie ersetzen (Rollback über Firebase-Hosting-Versionen).

---

## 2026-10-21 — Gemeinsamer Changelog

Universalisierten VitalOS-Release-Dialog über vendorte Vite-Module eingebunden. Standalone mit eigener Bestätigung; eingebettet unterdrückt zugunsten des zentralen Shell-Dialogs.

# Fuel-Mini-Apps: optimistisches Speichern (2026-10-16)

- Mahlzeiten, Notizen, Kataloge und Mikros werden in der Cloud-Version nach dem lokalen Sichern quittiert (`background: true`); Log-Tab (`LogView`): Hinzufügen/Ändern/Löschen/Nochmal loggen patchen den Tages-Cache sofort (`optimisticMeal.js`, gleicher `changeLog` wie Outbox/Transaktion), ID und Zeitpunkt werden vorab erzeugt, damit der angezeigte Eintrag dem späteren Cloud-Eintrag entspricht.
- Tests: 6 neue, Suite 51/51; `build:cloud` und `build:solo:log` ok.
- Nicht getestet: Gefühl/Timing auf dem Gerät, Fehlerfall nach der Quittung (geblockter Eintrag im StorageStatus).
- Offen/Beobachtung: Login auf dem iPad (Google-Popup läuft durch, App bleibt abgemeldet) — Verdacht Safari-Speicherpartitionierung wegen `authDomain: fitness-aos.firebaseapp.com` (Drittanbieter zur Mini-App-Domain); siehe Gespräch 2026-10-16, braucht Konsolen-Schritt (OAuth-Redirect-URIs).

# Offline-Schreiben: Katalog, Notizen und Mikros über die Outbox (2026-10-16)

- Befund: Das Kern-Schreiben (Mahlzeiten, Supplement-Einnahmen) war in der Cloud-Version bereits offline-fähig (localStorage-Outbox, Operations-Quittung, StorageStatus). Lücken: Katalog (Transaktion → offline Fehler), Notizen, Mikros.
- Neu: Outbox-Arten `catalog:nutrition|supplements`, `notes`, `micros` (`cloudOutbox.js`, Logik in `cloudOutboxOps.js`), `api.cloud.js` schreibt darüber; Lese-Sichten rechnen offene Änderungen ein. Ströme getrennt: ein geblockter Log-Eintrag hält Katalog/Notizen/Mikros nicht mehr auf (und umgekehrt).
- Tests: 13 neue (Ops, Outbox-Arten, Ströme, Reihenfolge, Idempotenz), gesamte Suite 45/45 grün; Builds `build:cloud` und `build:solo:supplements` ok. `weekly-micros.test.mjs`-Mock um die neuen Exports ergänzt.
- NICHT gebaut: Hintergrund-Sync bei geschlossener App (Outbox in localStorage; bräuchte IndexedDB + SW-`sync`), Warteschlange für den lokalen Fastify-Build, Outbox für Wasser/Gewicht/Einstellungen. NICHT getestet: echter Offline-Durchlauf auf dem Gerät (Flugmodus: Katalog bearbeiten, Notiz schreiben, wieder online).

# Splash-Screen auch in der Fuel-Haupt-App (2026-10-16)

- `cli.mjs splash` im Build der Haupt-App (`build:local`, `build:cloud`); Geprüft am Cloud-Build (Splash "Fuel", Icon `./icons/icon-192.png`). Auth-Domains der vier Mini-Apps (8 Einträge) per Identity-Toolkit-API nochmals live geprüft: vollständig. Preview-Channel-URLs (`…--dev-xxxx.web.app`) sind nicht eingetragen → Google-Login nur dort nicht möglich.

# Fuel-Service-Worker auf das Mini-App-Shell-Template umgestellt (2026-10-16)

- `public/sw.js` (231 Zeilen) → `docs/archive/sw.fuel-main-v1.js`; Fuel-Teil (Push, Supplement-Quick-Actions, eigener notificationclick) nach `scripts/fuel-sw-extra.js`, Rest aus `mini-app.json` (`apps.fuel`). Gilt für `dist` (build:local), `dist-firebase` (build:cloud) und alle Solo-Apps; Build-Skripte/`stamp-solo.mjs` rufen `cli.mjs sw`.
- Paritätstest (`cli.mjs parity`, neu im Paket): 0 Abweichungen bei 30 Szenarien online/offline; gewollt abweichend nur Seitenaufruf (netz-first statt cache-first) und Nicht-GET (am SW vorbei).
- Funktionstest in vm-Sandbox: FCM-Push → Notification; Quick-Yes/Snooze rufen lokal `/supplements/log` + `/push/snooze`, in der Cloud die Functions `quickLogSupplement`/`snoozeSupplement`, mit Base-Pfad `/app/…`; genau ein push- und ein notificationclick-Listener.
- Builds geprüft: build:cloud, build:solo:log (SW syntaktisch ok, Stempel `fuel-v<build>`, Manifest-Version).
- NICHT getestet: echter Push/Quick-Action auf dem Gerät, SW-Update einer bestehenden Installation.
- Nicht angefasst: `frontend/public/sw.js` (`fuel-v12`, von Hand versioniert, eigenes workbox-Setup im Fork — Besitzer prüfen, ob noch genutzt) und `~/vitalos/fuel-os/public/sw.js`.

# RESULTS.md

Session-Log mit datierten Ergebnis-Bullets.

## 2026-10-23: Fuel-Release von den Mini-Apps getrennt

- `fuel-release --yes` wählte nur `fuel`. Der VitalOS-Commit `a21a633` verschob trotzdem zusätzlich die vier `vos-fuel-*`-Gitlinks von `05b2051` auf `b5ec24b`, weil `bin/vos-release` sie beim Fuel-Release automatisch mitgepinnt hat.
- `deploy-fuel.yml` führte seit `cba31a2` zusätzlich `build:solo` aus und deployte `hosting:log`, `hosting:supplements`, `hosting:mikros` und `hosting:protokoll` zusammen mit `hosting:client`. Damit löste ein Fuel-Pointer-Bump auch den Mini-App-Deploy aus.
- Der Hinweis zu `plan-app` kam vom allgemeinen VitalOS-Pre-Commit-Pointer-Sync. In `a21a633` blieb `plan-app` bei `cd5a27d`; der nicht remote erreichbare Checkout `88766b4` wurde ausdrücklich nicht übernommen. Der Plan-Pointer wurde später separat in `9de2327` aktualisiert.
- Korrektur: `fuel-release` bumpte keine Mini-App-Pointer mehr; `deploy-fuel.yml` baut und veröffentlicht nur `hosting:client`. Mini-App-Sites bleiben stabile Fallbacks und werden einzeln manuell über `pnpm run deploy:solo:<ziel>` veröffentlicht.
- Der GitHub-Actions-Lauf zum Release ließ sich wegen nicht erreichbarer GitHub-API nicht nachträglich abrufen; ob der damalige Mini-App-Deploy alle Sites erfolgreich aktualisiert hat, ist daher nicht bestätigt.

## 2026-10-16: Optimistische Einnahmen und Supplement-Wochentracker

- Einnahmen und Entfernen aktualisieren den gemeinsamen Tagescache sofort. Stabile IDs erlauben direktes Rückgängigmachen; Fehler-Rücknahme betrifft nur den eigenen Befehl und lässt andere Eingaben stehen. Kontowechsel wird beim Patchen und Senden berücksichtigt.
- Cloud-Einnahmen werden zuerst dauerhaft in der bestehenden kontogebundenen Outbox gesichert und sofort lokal bestätigt; Transaktionen/Replay laufen im Hintergrund. Fehlgeschlagene Befehle bleiben mit Fehler sichtbar und werden nicht als erfolgreiche Einnahmen projiziert. Die Statusleiste aktualisiert gezielt den betroffenen Tag bei Outbox-Änderungen.
- Wochentracker (Mo–So) pro Supplement auf der Tagesseite und als eigener Bereich: Wochenwechsel, Suche, geplante/freie/erfasste Tage, Einnahmetage und Mehrfach-Einnahmen. Vergangenheit und heute sind anklickbar; Zukunft ist eine reine Planansicht. Tagesansicht und Tracker teilen dieselben Query-Keys.
- Lokales API akzeptiert ebenfalls die clientseitige Einnahme-UUID, damit optimistische Einträge beim Wechsel zwischen Ansichten ihre Identität behalten. Ein schmaler Header-Überlauf wurde behoben.
- Verifiziert: alle 9 Node-Testdateien erfolgreich (zusätzliche Tests für gezielte Rücknahme, lokale Bestätigung vor Cloud-Abschluss und blockierte Hintergrundfehler), Solo-Produktionsbuild, `git diff --check`.
- Isolierter Firefox mit Testdaten und künstlich drei Sekunden langsamen Schreibvorgängen: sofortiges Setzen/Rücknehmen und andere Supplement-Eingaben bleiben bedienbar. Inhaltsbreiten 390 und 320 Pixel ohne horizontalen Überlauf geprüft. Keine echten Nutzerdaten verändert.
- Solo-Hosting-Deploy erfolgreich: https://vos-fuel-supplements.web.app. Authentifizierte echte Cloud-Schreibvorgänge/Push wurden nicht auf einem Nutzerkonto getestet.


## 2026-10-16: Eigenständige Supplements-Mini-App

- Eigener Solo-Einstieg (`solo-main.jsx`), Supplements-Datenabruf erst nach Login und ohne Nutrition-/Journal-Abfragen. Kontowechsel leert den Query-Cache; Login-Fehler werden angezeigt.
- Neues Frontend mit Tagesfortschritt, Bereichen für Routine/Einnahmen/Katalog/Auswertung/Erinnerungen, Wochenvorschau, Datumsauswahl und Katalogsuche samt Planfilter.
- Reminder-Zeiten und FCM-Registrierung direkt in der Mini-App; Settings-Updates schreiben ausschließlich die zugehörigen Felder per Merge.
- Tages-Checkliste als Tastatur-bedienbare Buttons, Schutz während Speichern/Refetch und Fehlerfeedback. Katalog-Editor validiert Pläne, erlaubt „Bei Bedarf“ und bewahrt Metadaten bei Cloud-Updates.
- Zyklische UI-Pläne gelten nicht mehr vor dem Startdatum. Cloud-Statistik liest das tatsächliche Datumfenster und zählt eindeutige Einnahmetage statt Dosen; auch Produkte ohne Einnahmen werden angezeigt.
- Eigenes Branding „VitalOS Supplements“, relative Build-Pfade, bestehende gemeinsame Firestore-Daten ohne Migration. Anleitung: `SUPPLEMENTS-APP.md`.
- Verifiziert: alle 9 Node-Testdateien erfolgreich, darunter 4 neue Supplement-Testfälle; Solo-Produktionsbuild; isolierte Render-Prüfung für leer/geplant/erledigt; `git diff --check`.
- Firebase-Deploy ausschließlich `hosting:supplements` erfolgreich: https://vos-fuel-supplements.web.app. Live-HTML, Manifest und Service Worker liefern HTTP 200 und stimmen bytegenau mit dem finalen Build überein.
- Offen: angemeldeter Geräte-Test für Cloud-Schreibvorgänge und tatsächliche Push-Zustellung. Bestehende Reminder-Functions wurden nicht verändert/deployed. Vite meldet weiterhin große Vendor-Chunks. pnpm-Engine-Store war im Sandbox-Lauf read-only; Build und Stamp wurden über die installierten Node-Einstiegspunkte ausgeführt.


## 2026-10-16: PreCompact-Hook: Gemini-Review-Fix (RESULTS/NEXT-Handoff)

Prüfung, ob die Compact-Hooks für `RESULTS.md`/`NEXT.md` tatsächlich laufen: konfiguriert waren sie,
Lebenszeichen gab es keins (kein `pre-compact-fill-docs.log`, letzter `docs: auto-update`-Commit alt).

- **`.claude/hooks/pre-compact-fill-docs.sh`:** Ursache gefunden — `gemini_call()` übergab den Prompt als
  Argument (`jq --arg` / `curl -d "$body"`); große Transcript-Ausschnitte sprengten das Linux-Limit von
  131072 Bytes pro Argument, der Fehler wurde von `2>/dev/null` verschluckt, alle Modelle galten als
  „fehlgeschlagen“. Jetzt: Prompt über stdin → Temp-Datei → `curl --data-binary @file`, Fehlerursache je
  Modell steht im Log. Funktion isoliert mit 220-KB-Prompt getestet. Sicherung: `pre-compact-fill-docs.sh.bak-gemini`.
- **Hook-Lauf belegt:** der Hook läuft (`claude -p` ändert die Doku, `pre-compact-fill-docs.log` entsteht);
  ein Lauf schrieb `NEXT.md` fort (`e3a8ff7`, `docs: auto-update NEXT.md`) ohne `RESULTS.md` zu doppeln.
- **Hinweis:** `.claude/` ist in diesem Repo gitignored — die Hook-Änderung ist lokal, nicht versioniert.
- Verifiziert: Gemini-Funktion isoliert. **Nicht** bestätigt: erfolgreicher Gemini-Review im
  Ende-zu-Ende-Lauf nach dem Fix (Log zeigte zuletzt „kein Ergebnis“).

---

## 2026-10-16: Vier Fuel-Views als eigene Mini-Apps veröffentlicht

Muster wie `vos-training`/`vos-atlas` in fitness-dev: ein Repo, ein Modus je App, kein Fork
(vier schon angelegte Forks `~/fuel-<x>-dev` wurden verworfen und nach
`~/.archive/fuel-solo-forks-2026-10-16/` verschoben, nie auf GitHub angelegt).

- **Solo-Modus:** `VITE_SOLO=log|supplements|micros|report` — `src/client/routes.js` bündelt nur den
  gewählten Tab (Literal-Vergleich, damit Rollup die übrigen Imports verwirft),
  `src/client/SoloShell.jsx` ist die schlanke Shell (Login-Pflicht, Tagesnavigation, Update-Button),
  `vite.config.cjs` schreibt nach `dist-solo-<tab>/`. Build: `pnpm run build:solo[:<tab>]`.
- **Splash/SW/Manifest:** `@vos/mini-app-shell` (vendored nach `scripts/mini-app-shell/`, Konfig
  `mini-app.json`), `scripts/stamp-solo.mjs` stempelt SW-Version + Shell und räumt Haupt-App-Icons
  und `*.bak` aus dem Output. Der bestehende `public/sw.js` bleibt (`sw.mode: keep`).
- **Icons:** `solo-icons/<tab>/` aus `scripts/solo-icons.py` (Teller orange, Kapsel lime, Molekül rosa,
  Protokollblatt himmelblau).
- **Hosting:** `firebase.json` als Array (Targets `client`=`fuel-vos`, `log`, `supplements`, `mikros`,
  `protokoll`), Mapping in `.firebaserc`; `deploy:firebase`/`deploy:cloud`/`deploy-preview.mjs` nur noch
  `--only client`; neu `pnpm run deploy:solo:<log|supplements|mikros|protokoll>`.
  Im Meta-Repo `vitalos/.github/workflows/deploy-fuel.yml` auf `hosting:client` umgestellt.
- **Firebase:** Sites `vos-fuel-log|supplements|mikros|protokoll` angelegt; Auth-Domains
  (`.web.app` + `.firebaseapp.com`, 8 Einträge) in `fitness-aos` additiv ergänzt (Vorher/Nachher-Diff
  ohne Verlust). App Check ist für Firestore/Auth/ML `UNENFORCED`.
- **Live:** alle vier Sites deployt (`https://vos-fuel-<x>.web.app`), Links per wacli an den User.
  `fuel-release --yes` hat dev/vitalos/master gepusht (Pointer-Bump `5f93106`).
- **Secrets:** `vapid.env` (VAPID-Private-Key) war im öffentlichen Repo getrackt → `*.env`/`.env.*`
  gitignored, Datei enttrackt (`59b23b5`). Der Key steht weiter in der History.
- Verifiziert: vier Solo-Builds, Dry-Run der Hosting-Targets, Deploy-Meldungen. **Nicht** verifiziert:
  Rendering/Login im Browser (kein Headless-Browser verfügbar).

---

## 2026-10-13: fuel-dev + frontend/ auf pnpm umgestellt

- Analog zur fitness-dev/vitalos-Migration (gleiche Session): `package.json`
  (root `fuelctx` + `frontend/` React-Package für den Python-Server) von
  npm auf pnpm umgestellt — `packageManager`-Feld, interne `npm run` →
  `pnpm run`, `allowScripts` → `pnpm-workspace.yaml`/`allowBuilds`.
- `@vos/cross-app-aliases`: `file:../vitalos/packages/cross-app-aliases` →
  `optionalDependencies`-Eintrag `workspace:*`. Außerhalb von vitalos
  (Standalone-`~/fuel-dev`) wird die Dependency jetzt beim Install sauber
  übersprungen ("failed compatibility check, excluding") statt per
  `file:`-Copy-Bug auf einen falschen Pfad zu zeigen.
- In `frontend/` deckte der Umstieg zwei echte **Phantom-Dependencies** auf,
  die unter npm nur per Zufalls-Hoisting liefen: `@radix-ui/react-dialog`
  braucht `@radix-ui/react-dismissable-layer` top-level (für
  `useDismissableLayerSurface`), `firebase/auth` braucht `@firebase/auth`
  top-level — beide fehlten unter pnpms striktem `node_modules` und wurden
  jetzt als explizite `dependencies` ergänzt.
- `deploy.sh`: systemd-`ExecStart` (`npm run prod` → `pnpm run prod`),
  Staging-Build-Schritte (`npm run build:local`/`npm run build` im
  `frontend/`) und Prod-Node-Install (`npm ci --include=dev` →
  `pnpm install --frozen-lockfile`) umgestellt.
- `.githooks/pre-push`: `npm run firebase` → `pnpm run firebase`.
- CI (`.github/workflows/{deploy-master,preview-dev}.yml`, beide checken das
  vitalos-Meta-Repo aus für die Cross-Repo-Aliase): `pnpm/action-setup`
  ergänzt, `npm ci` → `pnpm install --frozen-lockfile`,
  `npm run X --workspace=Y` → `pnpm --filter ./Y run X`.
- `package-lock.json` (root + `frontend/`) lossless per `pnpm import` nach
  `pnpm-lock.yaml` konvertiert, dann entfernt.
- Beide Builds (`build:local`/`build:cloud` root, `build` in `frontend/`)
  grün verifiziert, Push auf `dev` inkl. automatischem Staging-Deploy
  (`~/.local/fuel`) erfolgreich durchgelaufen.
- Nebenbei: Bug in `~/vitalos/bin/vos-sync-submodule-pointers` gefunden und
  gefixt — `SUBMODULE_PATHS` listete `"learn-dev"` statt `"learn-app"`
  (einziger Eintrag, der beim *-app-Rename übersehen wurde).

## 2026-09-06 (Nachtrag 4: Cloud-Nachzug Vertex)

- Cloud-Pfad (`src/client/lib/aiMealLogger.js` → Firebase Vertex AI,
  `gemini-2.5-flash`) auf denselben Stand gebracht wie die lokale CLI.
- `analyzeMealText`-`responseSchema`: neues `components`-Array; Prompt fragt
  Zutaten mit Gramm-Menge + Rohgewicht-Regel für Trockenware.
- `normalizeComponents` / `amountToGrams` / `sumYieldG` als JS-Port von
  `catalog_lookup.py::_normalize_components` — identische Feldnamen.
- `resolveMealText`: `micros` + `micros_meta` + `components` direkt auf den
  Firestore-Log-Eintrag. Side-Doc `nutrition/{uid}/meta/micros` bleibt
  zusätzlich (Wochen-Heatmap aggregiert daraus).
- `api.cloud.js::autoUpsertCatalog`: `micros`/`components`/`yield_g` auf den
  Katalog-Eintrag; beim Update nur, wenn dort noch nichts Kuratiertes steht.
- Keine Firestore-Rules-Änderung nötig (doc-, nicht feldbasiert).
  `build:cloud` + `build:local` grün. Commit `5728166`.

## 2026-09-06 (Nachtrag 3: Mikros + Zutaten ins JSON)

- `fuel "<desc>"` verwarf bisher alles außer den 4 Makros. Derselbe
  Gemini-/Haiku-Call (`estimate_nutrition`, `PROMPT_TEMPLATE`) liefert schon
  `macros` + `micros` (24 DACH-Werte) + `components` — `estimate_macros_only`
  hat nur die Makros durchgereicht.
- `fuel/meal.py`: `_parse_macros_with_gemini` nutzt jetzt die Vollschätzung.
  `do_meal_log` schreibt `micros` + `micros_meta`
  (`{source, method:"meal_estimate", resolved_at}`) und normalisierte
  `components` in den Log-Eintrag (`~/.aos/fuel/nutrition/<date>.json`) und —
  bei `--save-catalog` — in den Catalog-Entry.
- `fuel/catalog_lookup.py`: `save_meal` bekommt kwargs `micros`/`components`
  und schreibt sie in die git-/Firestore-getrackte `catalog.json`.
  `_normalize_components` parst `amount_g` aus Geminis `qty`-Freitext, legt
  `per_100g`/`micros_source` als Platzhalter an; `yield_g` = Summe der
  Zutaten-Gramm.
- Terminal-Output jetzt informativ: volle Makrozeile, Mengen-Annahme
  (Text vs. Ø-Portion), Rohgewicht-Hinweis bei Trockenware, Zutatenliste,
  Micro-Anzahl, Tages-Zwischensumme.
- **Noch offen:** Zutaten-Mikroprofile pro 100 g (echte Ingredient-DB) —
  braucht einen Resolve-Call pro Zutat, markiert via `micros_source: null`.
- Getestet mit gefaktem `estimate_nutrition`-Return + Syntax/Import — kein
  echter LLM-Call verbraucht. Commit `7c35d7e`.

## 2026-09-06 (Nachtrag 2: Ernährungsprotokoll-Report)

- Neuer Tab `report` ("Protokoll", `FileText`) nach `Historie` — abgabefertiges
  7-/14-Tage-Ernährungsprotokoll für die FFA-Aufgaben (Ernährungstrainer
  Task 1 „7 Tage Makronutrient-Protokoll" + Task 19 „14 Tage Diät-Protokoll",
  Fitnesstrainer-Zusatzaufgabe Task 147). `src/client/views/Report/NutritionReportView.jsx`.
- Rein clientseitig über `fetchJson("/nutrition/history?limit=180")` (@api →
  Fastify lokal / Firestore cloud), kein neuer Server-Endpoint. Der in
  CLAUDE.md geplante `GET /nutrition/export?from=&to=` bleibt damit unnötig.
- Ausgabe: weißes „Blatt" (`.report-sheet` in `styles.css`, sichtbar wie
  gedruckt), pro Tag Tabelle Nahrungsmittel/Getränk × kcal/KH/Fett/EW,
  gruppiert nach Vormittag (<12) / Nachmittag (12–17) / Abend (≥17) aus dem
  `time`-Feld (Fallback über `meal.type`), Slot-Zwischensummen + Tages-
  Gesamtkalorien + energetische Makro-Verteilung (%). Deckblatt mit Name
  (localStorage), Zeitraum, Erhebungsmethode; Auswertungstabelle mit Ø/Tag.
- Zeitraumwahl: Presets 7 / 14 Tage / frei (Von–Bis). Tage ohne Log werden
  als „Keine Einträge" ausgewiesen. Druck via `window.print()`, Print-CSS in
  `styles.css` (`@media print`: Header/Nav weg, `@page`-Rand, Seitenumbruch
  alle 3 Tage).
- `build:local` + `build:cloud` grün, eigener Lazy-Chunk `NutritionReportView`.

## 2026-09-06 (Nachtrag: Tab-Reihenfolge + Katalog-Trennung)

- Tab-Reihenfolge auf User-Vorgabe umgestellt (`routes.js`):
  Dashboard · **Log** · Food · **Rezepte** · **Katalog** · Historie · Journal ·
  Supplements · Mikros · Setup · Dev. Log wandert direkt hinter Dashboard,
  Rezepte steht zwischen Food und Katalog.
- Food-Verlauf (unkuratierte Inbox „Noch nicht kuratiert") bleibt nur im
  Food-Tab: `FoodCatalog` bekommt Prop `showHistory` (Default `true`), die
  History-Inbox-Query ist per `enabled: showHistory` gated. `CatalogView`
  rendert `<FoodCatalog showHistory={false} />` → reiner Gerichte-Katalog.
- `build:local` + `build:cloud` grün.

## 2026-09-06

- Rezept-Builder aus `FoodView` herausgelöst: Komponente nach
  `src/client/views/RecipeBuilder/RecipeBuilder.jsx` verschoben, neue
  `src/client/views/RecipeBuilderView.jsx` (thin wrapper, `max-w-3xl`), eigener
  Tab `recipes` ("Rezepte", `ChefHat`) in `routes.js` nach dem Food-Tab.
- Katalog zusätzlich als eigene View + Tab: `src/client/views/CatalogView.jsx`,
  Tab `catalog` ("Katalog", `Library`). `FoodCatalog` bleibt weiterhin auch in
  `FoodView` eingebunden (bewusst redundant lt. Ansage).
- Header-Nav (Tab-Pills unter dem Date-Picker) wrappt jetzt statt horizontal zu
  scrollen: `<nav>` von `overflow-x-auto snap-*` auf `flex flex-wrap gap-2`,
  Pills ohne `shrink-0 snap-start` (`main.jsx`).
- `build:local` + `build:cloud` grün.

## 2026-09-03

- Firestore-Status im Fuel-Prod-Health-Payload und in `bin/fuelctl` getrennt:
  `pushCount` bleibt als Gesamtzähler bestehen, zusätzlich gibt es jetzt
  `catalogPushCount` und `runtimePushCount`. Die Dev-Ansicht zeigt dieselbe
  Aufteilung, damit `pushes=...` nicht mehr als unscharfer Sammelwert erscheint.
- Die sichtbare CLI-/npm-Frontdoor wurde von `sync` auf `cloud` umbenannt
  (`fuelctl cloud`, `fuel cloud`, `npm run cloud:{push,pull,watch}`), weil der
  bisherige Name semantisch zu eng bzw. irreführend war. Deprecated
  `sync:*`-npm-Skripte bleiben als Alias vorerst erhalten.
- Ein neuer echter `sync` wurde separat eingeführt:
  `fuelctl sync <uid>` bzw. `npm run catalog:sync -- <uid>`. Dieser Pfad
  gleicht nur Catalog-Daten ab und übernimmt nur fehlende oder neuere Einträge
  zwischen lokal und Firestore; Löschungen werden dabei bewusst nicht
  propagiert.
- Erkenntnis zur Semantik des bestehenden Firestore-Systems dokumentiert:
  Der Catalog-Pfad ist fachlich kein echter `sync`, sondern ein
  Vollschreib-/Publish-Pfad pro Zieldokument
  (`nutrition/<uid>/meta/catalog`, `supplements/<uid>/meta/catalog`).
  Bei jedem erfolgreichen Catalog-Push wird das komplette Catalog-Dokument neu
  nach Firestore geschrieben, nicht nur ein Delta.
- Der Runtime-Pfad (`nutrition/logs`, `nutrition/journal`, `supplements/logs`)
  bleibt der eigentliche Sync-Pfad. Er enthält Push/Pull/Pushback-Verhalten,
  einschließlich Self-Heal-Writebacks nach Enrichment oder Mikro-Resolution.

## 2026-08-07 (v4-Merge)

- `~/fuel/` (Python/FastAPI + Postgres, v4.0.0-Frontend) komplett nach hierher
  gemerged: `frontend/` + `backend/` (Code), plus Rest (`alembic/`, `main.py`,
  `pyproject.toml`, `docker-compose.yml`, Docs, `scripts/`) unter `backend/`.
  `.env` mit echtem `GEMINI_API_KEY` bewusst nicht kopiert (Credential-Leakage-Risiko).
- v3↔v4 Cross-Reachability-Proxies gebaut: `src/server/routes/v4-proxy.mjs`
  (`/v4/*`), `backend/api/endpoints/v3_proxy.py` (`/v3/*`) — reine Erreichbarkeit,
  kein gemeinsamer Datenlayer. Der Übergang ist bidirektional: v3 kann an v4
  weiterreichen, und v4 kann Legacy im Zweifel an v3 zurückdelegieren.
- `backend/core/config.py`: SQLite-Fallback-Pfad von relativ (`./backend.db`,
  wanderte je nach Start-cwd) auf an `backend/` geankert gefixt.
- v4 lokal end-to-end getestet: `uvicorn` auf :4000, `/health` ok, `/v3/health`
  erreicht laufenden Node-Server über Proxy, `/` liefert gebautes v4-Frontend.
- Historische v4-Ergebnisse aus `~/fuel/RESULTS.md` (2026-07-09/10): initiale
  Projektstruktur, Refactoring aller 9 Frontend-Views auf FastAPI-Backend,
  Umbau auf "Journal-First" `DailyJournal`-Modell, Mikronährstoff-Aggregation
  optimiert (`micros_sum` pre-calculated), `water_ml`-Spaltentyp gefixt.

## 2026-07-18

- **db-Layer-Cleanup (TODO.md):**
  - `src/client/lib/db/index.js` zunächst fälschlich als toten Code eingestuft und gelöscht — Grep hatte nur `fuel-dev/src` durchsucht. Tatsächlich wird die Datei über die Vite-Aliase `@db`/`@utils` (in `vite.config.cjs`) von `habits-dev` und `journal-dev` importiert, die wiederum via `@habits`/`@journal` in den fuel-dev-Build eingebunden werden (`HabitVosView.jsx`, `JournalVosView.jsx`). Build brach dadurch. Fehler erkannt, Datei + Aliase wiederhergestellt, Build erneut verifiziert (`npm run build:local` läuft sauber durch).
  - **Tatsächlich tote `.bak`-Dateien im db-Umfeld gelöscht** (verifiziert: kein Importer, keine Cross-Repo-Referenz, Build läuft ohne sie):
    - `src/client/lib/firestore-db.js.bak`
    - `src/client/routes.js.bak`
    - `src/client/lib/api.js.bak2`
    - `src/client/views/SettingsView.jsx.bak`
    - `src/client/lib/db/firestore/supplements.js.bak`
    - `src/client/lib/db/firestore/nutrition.js.bak`
    - `src/client/lib/db/firestore/core.js.bak`
    - (`store.js.bak` und `DailyChecklist.jsx.bak` existierten bereits nicht mehr)
  - `firestore-db.js` (ohne `.bak`) bleibt erhalten — ist aktiver Barrel auf `db.firestore.js`, wird aber selbst von nichts importiert (kein Cleanup-Kandidat laut TODO, nur geprüft).

- **Zeitzonen-Bug `todayISO()` gefixt (TODO.md):**
  - `src/shared/utils/validation.mjs::todayISO()` nutzte `new Date().toISOString().split("T")[0]` → UTC-Datum. Server läuft in Europe/Vienna (CEST, UTC+2) — zwischen 00:00 und 02:00 Uhr lokaler Zeit lieferte `todayISO()` noch das Datum von gestern. Betroffen: alle Server-Routes, die `todayISO()` als Default für fehlendes `date`-Query-Param nutzen (`nutrition/log`, `nutrition/notes`, `supplements`, `ai-log`).
  - Fix: Formel auf lokale Zeitzone umgestellt (`getFullYear/getMonth/getDate`, identisch zur bereits korrekten Client-Version in `client/lib/db/firestore/utils.js`).
  - Dedupe: `client/lib/db/firestore/utils.js` importiert `todayISO` jetzt aus `shared/utils/validation.mjs` statt es erneut zu implementieren. `localToday()` bleibt als lokaler Alias bestehen.
  - Verifiziert: `npm run build:local` erfolgreich, beide Module (`node --input-type=module`-Testaufruf) liefern identisches lokales Datum.
  - `randomId()`-Duplikat (unterschiedliches Format in Client vs. Server) bewusst nicht angefasst — kein Bug, nur Doppelimplementierung; separat zu klären (siehe NEXT.md).

## 2026-10-16 — Cloud-Schreibkonflikte

- Mahlzeiten, Wasser-Deltas, Supplement-Einnahmen und private Katalogänderungen nutzen Firestore-Transaktionen. Verschieben schreibt beide Tage atomar und hinterlässt einen Quell-Tombstone.
- Mikronährstoff-Auswertungen schreiben keine alten Mahlzeitenlisten mehr zurück; Tages-Caches werden nur bei unverändertem Ausgangslog geschrieben, Wochenansichten lesen aktuelle Tagesdaten.
- Prüfung: Konflikt-/Retry-/Move-/Tombstone-Tests mit simuliertem Firestore-Adapter; Firebase-Frontend-Build erfolgreich. Keine Live-Nutzerdaten verändert.

## 2026-10-16 — Speicherstatus und Offline-Änderungen

- Kontoabhängige, persistente Befehlswarteschlange für Tageslogs (Mahlzeiten/Wasser/Supplements), automatische Wiederholung nach Reconnect sowie manuelles Wiederholen/Verwerfen fehlgeschlagener Änderungen. Cloud-Transaktionsbelege verhindern doppelte Wiederholung nach verlorener Bestätigung.
- Ausstehende Änderungen werden in Tagesansichten projiziert. Statusleiste auch im Schnelleinstieg: Offline, lokaler Cache, ausstehende Cloud-Bestätigung, Schreib-/Lesefehler. Kontowechsel leert den React-Query-Cache.
- Prüfung: 5 Transaktions- und 3 Outbox-Tests (Konflikt, atomarer Move, Replay, Kontoisolation, Berechtigungsfehler, voller Speicher); Cloud-Build erfolgreich. Browser-/Live-Firebase-Prüfung steht aus.

## 2026-10-16 — Barcode-Produkterfassung

- Eigener Barcode-Modus: native EAN/UPC-Fotodecodierung, Prüfziffer-Prüfung, Open-Food-Facts-Abfrage mit Timeout und 30-Tage-Produktcache. Nummerneingabe als Fallback für Browser ohne BarcodeDetector.
- Produktwerte werden pro 100 g in das bearbeitbare Log-Formular übernommen; unbekannte Produkte/unvollständige Werte ergeben eine konkrete Fehlermeldung. Quellenhinweis und ODbL-Link im Scanner.
- Prüfung: 4 Tests für Prüfziffern, Produktdaten, Offline-Cache, fehlende Werte und native Decoder-Ressourcen; Cloud-Build erfolgreich. Physische Kamera und externer Produktabruf nicht live geprüft.

## 2026-10-16 — Scan-Profile durchgängig erhalten

- Bildanalyse gibt Mikronährstoffe, Bezugsgewicht, Herkunft und vorhandene Zutaten direkt an den Eintrag zurück. Formular, Katalog-Speichern, Wiederholen und Shutter-Schnelleinstieg erhalten diese Daten.
- Portionsänderungen skalieren Makros, Mikros und Zutatenmengen gemeinsam; kleine Mikronährstoffwerte bleiben erhalten. Barcode-Herkunft wird ebenfalls weitergereicht.
- Lokaler v3-HTTP-/SQLite-Pfad und v4-JSON-Pfad erhalten die Scan-Details. v4 aktualisiert Mikronährstoff-Tagesaggregate beim Bearbeiten, Verschieben und Löschen dieser Einträge.
- Prüfung: 3 Profil-/Skalierungstests, HTTP→SQLite→Edit-Test mit isoliertem temporärem Speicher, v4-Speicher-/Move-/Delete-Test mit In-Memory-SQLite; Cloud-Build erfolgreich. Keine Laufzeitdaten migriert.

## 2026-10-16 — Cloud-Backup und Wiederherstellung

- Setup bietet JSON-Export für eigene Firestore-Tageslogs, Wasser, Tagesnotizen/AI-Pending-Texte, private Essens-/Supplement-Kataloge, Profil/Settings und Fuel Frame. Export wartet auf bestätigte SDK-Schreibvorgänge; offene Outbox-Befehle müssen zuerst synchronisiert werden.
- Import prüft Formatversion, Konto, erlaubte Dokumenttypen/IDs, Eintrags-IDs, Mengen und Größen. Vorschau vor einer eigenen Wiederherstellen-Schaltfläche; additive Transaktionen erhalten aktuelle Werte und Löschmarkierungen. Unterbrochene Wiederherstellung nennt Fortschritt und kann ohne Duplikate wiederholt werden.
- Quelle ist ausdrücklich die Cloud, auch wenn Setup lokal geöffnet wird. Server-/SQLite-Daten gehören nicht zu diesem Cloud-Backup.
- Prüfung: 5 Tests für Validierung, Konto-/Pfadgrenzen, konfliktfreie Zusammenführung, Export/Import-Roundtrip, konkurrierende Änderungen und Wiederaufnahme; Cloud-Build erfolgreich.

## 2026-10-16 — Browser-Startblocker behoben

- Der gebaute Cloud-Client blieb im Firefox mit `Component app-check has not been registered yet` leer. App Check und Messaging fehlten in den gemeinsamen Firebase-Package-Aliasen; beide Build-Konfigurationen lösen sie nun wie die übrigen SDK-Module auf.
- Verifiziert: Cloud-Build und isolierter Firefox-Browserlauf bei 390×844. Setup/Backup wird gerendert, Backup-Aktionen sind ohne Konto gesperrt; Barcode-Nummer → simulierte OFF-Antwort → Beschreibung, 100-g-Bezugsportion und Makros im editierbaren Formular. Screenshot unter `/tmp/fuel-barcode-mobile.png`. Kein echter Cloud-Login/Schreibzugriff, kein Live-OFF-Abruf.

## 2026-10-16 — Abschließende Integration und Prüfung

- React Query führt Offline-Lese-/Schreibaufrufe sofort aus, damit Firestore-Cache und persistente Outbox erreichbar bleiben. Offline-Replay ergänzt den Mahlzeiten-Katalog im selben Transaktionsschritt und verhindert doppelte Nutzungszählung.
- Direkte SDK-Schreibfehler von Profil, Fuel Frame und Tagesnotizen werden sichtbar gemeldet. Supplement-Löschmarkierungen bleiben erhalten. Wochen-Mikronährstoffe werden ohne Rückschreiben berechneter Tagesdaten ausgewertet, einschließlich Herkunft je Mahlzeit.
- Mobile Dialoge sind auf die Viewport-Höhe begrenzt, scrollbar und haben einen zugänglichen Schließen-Button; Katalog-Fotologs erzeugen neue Ereignis-IDs.
- Verifiziert: 25 JavaScript-Tests in 8 Dateien (`npm run test:unit`), 1 Python-Test mit In-Memory-SQLite, Local- und Cloud-Build inklusive SW-Versionierung, `git diff --check`. Isolierter Firefox-Browserlauf bei 390×844 und 320×568: Backup ohne Login gesperrt; Barcode-Abfrage mit simulierten OFF-Daten übernimmt Beschreibung, Bezugsgewicht und Makros ins editierbare Formular; kleiner Dialog scrollt ohne horizontalen Überlauf.
- Kein Live-Firebase-Login oder Schreibtest mit echten Nutzerdaten, kein physischer Kameratest. Änderungen sind noch nicht deployed.

## 2026-10-17 — Offline-Cache bei Updates
Gemeinsame mini-app-shell erweitert bzw. aktualisiert: versionsunabhängiger öffentlicher API-Cache mit Migration, Asset-Precache standardmäßig aktiv, fehlgeschlagene Installation ersetzt bestehenden Worker nicht. IndexedDB/localStorage bleiben unverändert. Geprüft: 13 Shell-/Update-Tests, Private-Request-Test, Vendor-Parität. Kein Push/Release; kein physischer Geräte-Test.

## 2026-10-23 — Omega-3 als Schwerpunkt der Mikro-Erkennung

- ALA, EPA, DHA, DPA und EPA+DHA separat im gemeinsamen Nährstoffvertrag, Python-Schemas, CLI und Web-Erkennung ergänzt. Text-/Foto-/Mikroanalyse sowie Zutaten-/Supplement-Recherche erhalten Regeln für Einheiten, Portionen, Ölmengen und unbekannte Werte.
- USDA-EPA-Lücke geschlossen; g/mg explizit behandeln, unspezifisches 18:3 nicht als ALA ausgeben. Ableitungen addieren keine Gesamtsummen doppelt und erfinden keine Fettsäure-Aufteilung.
- 250-mg-Referenz auf EPA+DHA begrenzt (EFSA); Gesamtsumme/Einzelarten ohne pauschalen Prozentwert. Wochenansicht zeigt Datenabdeckung und bekannte Mengen; fehlende Details bleiben unbekannt statt scheinbar Null. Neue SQLite-Spalten sind nullable; Schema-Version erneuert alte Aggregat-Caches beim nächsten Abruf.
- Schwerpunkt, Datenvertrag, Grenzen und nächste Vertiefung in OMEGA3.md dokumentiert. Historische Profile werden nicht per KI zurückgefüllt.
- Verifiziert: komplette JS-Suite (13 Testdateien), 6 Python-Tests einschließlich USDA-Fälle, v4-Schema/Wochenabfrage und Scan-Persistenz; Local- und Cloud-Vite-Build erfolgreich; git diff --check sauber. API-/OCR-Antworten synthetisch, keine echten KI-Aufrufe oder Änderungen persönlicher Laufzeitdaten; kein Push/Deploy.

## 2026-10-23 — Release-Metadaten beim Omega-3-Release bereinigt

- Öffentliche Repository-URLs werden aus Protokoll, Host und Pfad aufgebaut; Zugangsdaten, Query und Fragment werden ausgeschlossen. Fix aus der gemeinsamen mini-app-shell-Quelle nach Fuel portiert.
- Gezielte Tests mit temporären Git-Repositories und künstlichem Token in beiden Generatoren erfolgreich.

# Python Backend Poetry Standard (2026-10-29)

- Python-Abhängigkeiten laufen jetzt einheitlich über `backend/pyproject.toml` + `backend/poetry.lock`; die parallele `requirements.txt`-Liste entfernt. README und Abhängigkeitsübersicht an Python 3.14+, Poetry 2+, SQLite als tatsächlichen Desktop-Produktionsspeicher und den optionalen PostgreSQL-Pfad angepasst.
- `backend/start-server.sh`, `fuel-devctl` und der `/opt/fuel-python`-Deploy installieren/verwenden dieselbe Poetry-Projektumgebung in `backend/.venv`; Migration und Uvicorn laufen mit dem gelockten Environment. Fuel API bleibt auf :4000; kein VitalOS-Portwechsel.
- FastAPI-Startup auf `lifespan` umgestellt; Backfill-Ausgabe nutzt den Uvicorn-Logger.
- `httpx` ist als direkte API-Abhängigkeit eingetragen; die bereits gelockte Version bleibt bestehen. PyPI war nicht erreichbar, daher den Hash mit Poetrys Locker aktualisiert statt die Paketauflösung zu ändern.
- Geprüft: `poetry -P backend check --lock` meldet `All set!`; kein Testlauf, Deploy oder Dienst-Restart ausgeführt.

## Fuel FastAPI in VitalOS; Port 4000 stillgelegt (2026-10-29)

- Auf Nutzerfreigabe `fuel-python.service` gestoppt und deaktiviert. Port :4000 ist geschlossen; Firebase bleibt der Produkt-Einstieg. Die Router laufen lokal im VitalOS-Backend auf :8000 unter `/api/fuel/*`; Coach-Forwarding ist live.
- `deploy.sh prod`, `fuel-prodctl` und `fuelctl` installieren/aktivieren den separaten Python-Dienst nicht mehr und prüfen stattdessen VitalOS `/api/fuel/health`. Eine alte Unit wird bei einem lokalen Prod-Deploy deaktiviert.
- Boot-Report-Registry von `VitalOS-Buchhaltung-API` auf `VitalOS-API` aktualisiert, damit :8000 als gemeinsame API erscheint.
- Live geprüft: Fuel und VitalOS Health auf :8000 sowie Coach `/api/fuel/health` liefern 200; :4000 ist geschlossen und `fuel-python.service` ist `inactive`/`disabled`. SQLite-Integrität und Alembic-Revision geprüft. Keine Testsuite ausgeführt.

## Fuel API in VitalOS Workspace eingebunden (2026-10-29)

- Fuel-Router sind in `backend/api/integration.py` aus dem Fuel-Source-Repo gruppiert und können sowohl von der Fuel-Standalone-App als auch vom Workspace-Server verwendet werden. Fuel-Migration/Backfill teilen denselben Initialisierungspfad.
- Die Workspace-Komposition mountet nur API-Router unter `/api/fuel/*`; der Fuel-Static-/SPA-Catch-all bleibt außerhalb. Fuel nutzt `FUEL_DATABASE_URL`, damit seine vorhandene SQLite-DB nicht mit VitalOS-Postgres kollidiert.
- `poetry -P backend check --lock` und `git diff --check` geprüft. Keine automatisierten Tests ausgeführt.

- Host-Aktivierung: Fuel-Backfill ignoriert jetzt JSON-Dateien, die keine Tageslogs sind, etwa `catalog.json`, und überspringt nicht lesbare/verschwundene Dateien. Der Docker-Daten-Mount erhält die absolute Symlink-Auflösung des Fuel-UID-Datenbaums; PostgreSQL-URL im VitalOS-Container erzwingt den installierten `psycopg2`-Treiber.
- Live geprüft vor Stilllegung: VitalOS `/health`, Fuel `/api/fuel/health`, Coach `/api/fuel/health` sowie Standalone-Fuel-Oberfläche und Health auf :4000 antworteten mit 200. Nutzer hat danach bestätigt, dass alle Fuel-Nutzer Firebase verwenden und die lokale API ungenutzt ist; Details siehe Abschnitt „Fuel FastAPI in VitalOS; Port 4000 stillgelegt“.


## 2026-10-30 — Fotoscanner für Jakob

- Globales `~/TODO.md`, Repo-TODO und Vertex-Roadmap mit dem tatsächlichen Code abgeglichen: Barcode-Decoder/Nummerneingabe/OFF/localStorage-Cache, Supplement-Vertex und entfallene vorzeitige Micros-Schreibvorgänge waren bereits vorhanden.
- Scanner bietet vor dem KI-Aufruf eine ausdrückliche Katalogauswahl mit vollständigen Makros. Katalogportion, Nährstoffherkunft und Katalog-ID bleiben erhalten; es wird keine Meal-Ereignis-ID aus dem Katalog kopiert. Automatische Namenserkennung aus beliebigen Fotos erfordert weiterhin die Bilderkennung.
- Cloud-Fotoschema liefert Hauptzutaten mit Mengen und Makros. Text und Foto teilen `mealComponents.js`; Portionskorrekturen skalieren Zutatenmengen und Zutatenmakros neben den Meal-Makros/Micros. Vorhandene normalisierte Komponenten und per-100-g-Referenzen bleiben unterstützt.
- Bildqualität nach Typ: Essen 1280 px/0,82, Etikett/Beleg 2048 px/0,92. Barcode-Decoder erhält weiter das unverkleinerte Bild.
- Foto-Warteliste in IndexedDB mit Konto, ursprünglichem Log-Datum und Scan-Typ: offline automatisch sichern, nach Online-Fehler auf Wunsch sichern; bewusste Wiederaufnahme und Entfernen mit sichtbarem Status. Maximal zwölf Bilder bis je 8 MB pro Konto/Gerät. Kein anonymer Cloud-Speicherbereich; Konto-Wechsel schließt den Dialog und verhindert späte Ergebnisübernahme. Andere Tage werden angezeigt und verlangen die passende Log-Datumsauswahl. Erfolgreiche Übernahme entfernt das Foto aus der Warteliste; der anschließende Formularentwurf bleibt wie bisher flüchtig bis zum Speichern.
- Shutter und Log-Scanner teilen denselben Dialog, einschließlich Katalog/Barcode/Warteliste. Die Kamera pausiert während des Dialogs; Vorschau-Object-URLs werden freigegeben. Die Analyse selbst schreibt weder Meal-Logs noch Micros.
- App-Check-Site-Key in Check-/Preview-/Live-CI verdrahtet (`vars.VITE_RECAPTCHA_SITE_KEY`, alternativ gleichnamiges Secret). Lokaler Key vorhanden; Projektregistrierung, CI-Variablenwert, Enforcement und echte Tokens bleiben offen. Rein lesender Prüfversuch ohne nutzbaren gcloud-Zugriffstoken; keine Firebase-Projekteinstellungen verändert.
- Validierung: 121 JavaScript-Tests erfolgreich; neue Pipeline-Tests mit künstlicher SDK/Canvas-Grenze prüfen Zutaten, Bildqualität, Offline-Verhalten und fehlende vorzeitige Schreibvorgänge. Queue-Tests prüfen Konto-Wechsel, Datums-/Datei-Erhalt, Größen-/Anzahlgrenzen und Speicherfehler. Anschließende gezielte Tests nach Katalog-ID-Ergänzung ebenfalls grün.
- Bestehende Release-Test-Fixture von `src/views/Test.jsx` nach `src/views/Food.jsx` umbenannt: Der bestehende Release-Filter schließt Test-Dateien aus, dadurch war die erwartete Release-Metadatenantwort zuvor null. Produktionslogik unverändert. Git-Unterprozesse der Suite benötigten Ausführung außerhalb der Sandbox.
- Cloud- und Local-Vite-Build erfolgreich (bekannte Chunk-Größenwarnung). Isolierter Thorium-Test mit echten React-/Radix-Komponenten und IndexedDB, künstlichen Konten/KI-Antworten: Katalog überspringt KI, Offline-Foto übersteht Reload, Konto-/Datumswechsel isoliert, Wiederaufnahme normalisiert Zutaten; 320×568 scrollbar ohne horizontalen Überlauf, Escape schließt den Dialog. Screenshot: `/tmp/fuel-scanner-review/mobile.png`.
- Kein echter Kamera-/Firebase-/App-Check-Token-Test, kein Push/Release/Deploy. Geräteabnahme nach Freigabe weiter offen.

## 2026-10-31 — Dependabot

Enabled Dependabot alerts and security updates. Configured weekly GitHub Actions and npm/pnpm updates plus Python dependency updates; version updates target `dev`. Minor/patch updates are grouped; vendored mini-app-shell copies stay maintained at their source. Validated YAML, repository manifest paths and update targets.
