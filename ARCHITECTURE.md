# Fuel Centre Architecture

Stand: 2026-08-31

## Scope

Dieses Dokument beschreibt den tatsächlich verifizierten Stand von `fuel-dev`:

- v3 Runtime: Node/Fastify in `src/server`
- v4 Backend: Python/FastAPI in `backend/`
- Cloud Client: Firebase Hosting + Firestore
- Lokale Persistenz: `~/.aos/fuel`

Es dokumentiert bewusst auch die gefundenen Failure-Modes, damit `default` und
falsche UID-Fallbacks nicht erneut als "normal" behandelt werden.

## High-Level Model

Fuel hat zwei klar getrennte Datenklassen:

1. Runtime user data
   - nutrition Tageslogs
   - nutrition journal
   - supplements logs
   - lokale SQLite-Caches und Runtime-Indices

2. User-specific catalogs
   - nutrition catalog
   - supplements catalog

Im Unterschied zu Fitness sind Fuel-Catalogs nicht global. Der vorhandene
Fuel-Catalog ist immer ein User-Catalog.

## User Identity And Routing

Der Node-Server normalisiert eingehende Requests in `src/server/app.mjs`.

- Bare paths ohne Client-Prefix laufen als `default`
- `/c/<clientId>/...` wird auf den echten Client aufgelöst
- `req.clientId` wird zu `req.uid` über `src/server/lib/client-manager.mjs`
- `req.paths` wird über `src/server/config/paths.mjs` user-spezifisch erzeugt

Entscheidende Regel:

- `default` ist local-only fallback
- `default` ist kein echter Cloud-User
- `default` darf niemals in Firestore als Owner verwendet werden

## Local Data Layout

Fuel speichert Userdaten unter `~/.aos/fuel/users/<uid>/...`.

```text
~/.aos/fuel/
├── users/
│   └── <uid>/
│       ├── nutrition/
│       │   ├── YYYY-MM-DD.json
│       │   ├── YYYY-MM-DD.deleted.json
│       │   ├── catalog.json
│       │   ├── micros-catalog.json
│       │   └── nutrition.db
│       ├── nutrition_journal/
│       │   └── YYYY-MM-DD.md
│       └── supplements/
│           ├── catalog.json
│           └── logs/
│               ├── YYYY-MM-DD.json
│               └── YYYY-MM-DD.deleted.json
└── ...
```

`default` nutzt denselben Shape direkt unter `~/.aos/fuel/`, aber nur lokal.

## Catalog Ownership

### Fuel

Fuel-Catalogs sind user-scoped:

- nutrition catalog: `~/.aos/fuel/users/<uid>/nutrition/catalog.json`
- supplements catalog: `~/.aos/fuel/users/<uid>/supplements/catalog.json`

Der frühere Repo-Pfad `catalogs/nutrition/meals/*` ist für aktive Fuel-User
nicht mehr die kanonische Runtime-Quelle. Er bleibt nur als Legacy-/Fallback-
Material relevant.

### Fitness

Fitness hat globalere Catalogs und getrennte Runtime-Userdaten. Diese Abweichung
ist absichtlich und darf nicht in Fuel "vereinheitlicht" werden.

## Runtime Persistence

### Nutrition

Nutrition Runtime lebt pro User in zwei Formen:

- JSON-Tagesdateien in `nutrition/YYYY-MM-DD.json`
- SQLite in `nutrition/nutrition.db`

Die SQLite-DB enthält normalisierte Meal- und Water-Rows und dient als
serverseitige Runtime-Sicht. Sie ist jetzt pro User isoliert.

Wichtige Tabellen:

- `meals`
- `daily_water`
- `ingredients`
- `meal_micros`

### Supplements

Supplements Runtime ist dateibasiert pro User:

- `supplements/logs/YYYY-MM-DD.json`
- `supplements/logs/YYYY-MM-DD.deleted.json`

### Journal

Nutrition Journal ist ebenfalls pro User:

- `nutrition_journal/YYYY-MM-DD.md`

## Graveyard / Tombstones

Beide Runtime-Bereiche haben ein Graveyard-System.

### Nutrition

- Day-level deletes: `nutrition/YYYY-MM-DD.deleted.json`
- Catalog tombstones: `nutrition/catalog.json` Feld `deleted_ids`

Zweck:

- lokal gelöschte Meals werden beim nächsten Pull nicht wiederbelebt
- lokal tombstoned Catalog-IDs gewinnen gegen ältere oder doppelte Remote-Items

### Supplements

- `supplements/logs/YYYY-MM-DD.deleted.json`
- Log-Feld `deleted_intake_ids`

## Firestore Layout

Fuel schreibt nicht in ein globales Shared-Dokument, sondern pro UID:

```text
nutrition/<uid>/meta/catalog
nutrition/<uid>/logs/<date>
nutrition/<uid>/journal/<date>

supplements/<uid>/meta/catalog
supplements/<uid>/logs/<date>
```

## Firestore Sync Ownership

Der Fuel Firestore-Sync lebt in `src/server/lib/firestore-admin.mjs`.

Er ist der eigentliche Node-seitige Transport-Layer für:

- nutrition catalog push/pull
- supplements catalog push/pull
- nutrition runtime log push/pull
- supplements runtime log push/pull
- nutrition journal push/pull

Der Sync ist multi-UID-fähig und entdeckt User aus:

- `FUEL_CLOUD_UID`
- `FUEL_CLOUD_UIDS`
- `~/vital/Klienten/*/client.json`
- lokalen `~/.aos/fuel/users/*` Ordnern

## Firestore Semantics

Die aktuelle Implementierung enthält fachlich zwei verschiedene Klassen von
Schreibvorgängen, die historisch beide unter "sync" laufen:

- `catalog`: Publish/Deploy-Semantik
- `runtime`: echte Sync-Semantik

### Catalog Publish

Betroffene Dokumente:

- `nutrition/<uid>/meta/catalog`
- `supplements/<uid>/meta/catalog`

Bei jedem erfolgreichen Catalog-Push schreibt Fuel das komplette Ziel-Dokument
neu nach Firestore. Es wird kein feingranulares Delta übertragen. Der Vorgang
ist deshalb semantisch näher an "publish" oder "deploy" als an klassischem
"sync".

Folge für Diagnose und Statusanzeigen:

- ein hoher `catalogPushCount` bedeutet zunächst nur, dass häufig ein voller
  Catalog-Write ausgelöst wurde
- daraus folgt nicht automatisch, dass sich viele einzelne Catalog-Einträge
  verändert haben

### Runtime Sync

Betroffene Dokumente:

- `nutrition/<uid>/logs/<date>`
- `nutrition/<uid>/journal/<date>`
- `supplements/<uid>/logs/<date>`

Der Runtime-Pfad ist der eigentliche Sync-Layer: lokale Änderungen pushen nach
Firestore, Pull-Zyklen holen Remote-Änderungen zurück, und Self-Heal-/
Normalization-Pfade können bereinigte Daten wieder hochschreiben.

### Status Counter Semantics

Die Statusausgabe soll diese Trennung sichtbar halten:

- `catalogPushCount`: Vollschreib-Events für Catalog-Dokumente
- `runtimePushCount`: Pushes für Logs und Journal
- `pushCount`: Summe aus beiden Klassen

### Actual Catalog Sync

Der echte CLI-Sync ist jetzt getrennt vom Cloud-Transport:

- `fuelctl sync <uid>`
- `scripts/firestore-sync.mjs sync <uid>`

Dieser Pfad ist bidirektional, aber nicht destruktiv:

- fehlende Remote-Items werden aus lokal ergänzt
- fehlende lokale Items werden aus remote ergänzt
- bei Konflikten gewinnt der neuere Stand anhand von `updated_at`
- Löschungen werden nicht propagiert

## Sync Execution Policy

Standardverhalten seit 2026-08-31:

- lokaler Prod-Server auf Port `7000`: Firestore-Sync standardmäßig aktiv
- Dev-Server auf Port `9000`: Firestore-Sync standardmäßig aus
- Override nur explizit über `FUEL_ENABLE_FIRESTORE_SYNC=1`

Begründung:

- Dev und Prod sollen nicht parallel dieselben Userdaten syncen
- sichtbare Server-Logs müssen klar einem aktiven Sync-Owner zuordenbar sein

### Dev Service Boundary

Für den lokalen Dev-Stack gilt seit 2026-08-31 zusätzlich:

- ein eigener `fuel-dev.service` ist architektonisch unerwünscht
- Dev soll terminalgeführt bleiben über `fuel-devctl` oder direkte `npm run dev*`
- ein systemd-Dev-Service verwischt die Grenze zwischen bewusst gestarteter
  Entwicklungsumgebung und dauerhaft laufendem Prod-Betrieb

Pragmatische Folge:

- v3/Vite-Start im Dev lieber über Terminal-Kommandos
- Prod bleibt systemd-owned
- Dev-Prozessprobleme sind eher im Frontdoor-/CLI-Flow zu lösen als durch
  mehr systemd-Automation

## v3 / v4 Boundary

Fuel befindet sich in einem Übergang:

- v3 Node/Fastify ist der lokale Runtime- und Kompatibilitäts-Layer
- v4 Python/FastAPI läuft parallel und kann bestimmte Pfade bedienen
- manche v3 Routes versuchen zuerst `callV4(...)` und fallen dann lokal zurück

Wichtig:

- die User-Isolation darf in beiden Schichten nicht verloren gehen
- ein v3 Fallback darf niemals implizit wieder auf einen globalen User-Speicher
  schreiben

### Open Direction

Stand 2026-08-31 ist Prod noch v3-fronted (`fuel.service` auf `:7000`) mit
parallelem v4-Service auf `:4000`.

Offene Architekturfrage:

- ob Desktop-Prod mittelfristig nicht direkt v4 als eigentlichen Prod-Entry
  nehmen sollte
- statt v3 dauerhaft als Frontdoor vor einem ebenfalls laufenden v4-Service zu
  behalten

Hintergrund:

- der aktuelle Dualbetrieb erhöht Betriebs- und Debug-Komplexität
- `fuelctl prod status`/`fuel-prodctl` fokussieren historisch noch primär v3
- Dev/Prod-Grenzen werden klarer, wenn das Zielbild explizit festgelegt wird:
  v4 als echter Prod oder bewusster Dauerbetrieb von v3+v4

### v4 Repo Shape

Die v4-Struktur lebt in diesem Repo parallel zu v3:

```text
backend/
├── alembic/
├── core/
├── db/
├── routers/
├── schemas/
├── main.py
└── pyproject.toml

frontend/
├── src/
├── public/
├── package.json
└── vite.config.*
```

Wichtig:

- `backend/pyproject.toml` gehört zum Python-v4-Backend
- das Root-`pyproject.toml` gehört nicht zu dieser v4-App selbst, sondern zur
  separaten `fuel`-CLI/Repo-Root-Tooling-Schicht

### v4 Data Flow

Der v4-Pfad ist weiterhin relevant, auch wenn v3 lokal noch Entry-Point sein
kann:

1. User Input kommt über FastAPI-Routen oder v3-Bridge im `backend`
2. Parsing/LLM-Logik lebt in `backend/core/llm.py`
3. Schemas und Typisierung liegen in `backend/schemas/`
4. Persistierung läuft über `backend/db/models/`
5. FastAPI servt bei gebautem Frontend auch die SPA aus `frontend/dist`

### v4 Journal-First Model

Das v4-Backend hat zusätzlich ein Journal-orientiertes Modell:

- `backend/db/models/journal.py`
- `DailyJournal` als Tagesanker
- `food_logs`, `habits`, `notes`, `micros_sum` als JSON/JSONB-nahe Felder

Dieses Modell ist für den Python-Stack weiterhin relevant, auch wenn der
aktuelle Fuel Runtime-Sync in Node/Firestore pro User mit Tageslogs arbeitet.

### v4 Calories Naming

Die ältere Konvention bleibt dokumentationswürdig:

- Backend/API bevorzugt `calories`
- Frontend/UI mappt für die Anzeige oft auf `kcal`

Grund war die frühere Vermeidung von Konflikten mit KDE-`KCal`. Im heutigen
Repo existieren dennoch auch viele `kcal`-Felder, vor allem im v3- und
Sync-Bereich. Diese Benennung ist daher historisch gemischt und muss bei
Bridges bewusst gemappt werden.

### v4 Frontend Serving

FastAPI kann das React-Frontend direkt ausliefern:

- Build in `frontend/` erzeugt `frontend/dist`
- FastAPI servt statische Assets
- SPA-Routen fallen auf `index.html` zurück
- lokal läuft v4 auf Port `4000`

Trotzdem ist in der aktuellen Desktop-Topologie der lokale Haupteinstieg noch
nicht ausschließlich FastAPI:

- v3/Node bleibt auf Port `7000` bzw. `9000` der lokale Frontdoor-Layer
- v3 kann selektiv an v4 weiterreichen
- deshalb müssen Architekturänderungen immer beide Schichten mitdenken

## Logging

Node nutzt strukturierte Logs über Fastify/Pino.

- Dev: `pino-pretty`
- Prod: Standard-Fastify-Logger

`firestore-admin.mjs` loggt bewusst mit sichtbaren Feldern wie:

- `scope=catalog|runtime`
- `direction=push|pull|pushback`
- `uid=<uid>`
- `target=...`
- `result=...`

Das ist wichtig, damit Sync-Vorfälle in den Server-Logs klar pro User lesbar
bleiben.

## Interactive Daily Notifications

Seit dem 2. September 2026 nutzt Fuel ein gemeinsames Notification-Schema für
lokalen Node-Push und Firebase-FCM-Push.

Ziel:

- tägliche Einstiege mit sehr niedriger Hürde
- klickbare Actions statt nur stumpfer Reminder-Texte
- dieselben Intent-Namen lokal und in der Cloud
- serverseitig sichtbare Logs pro Prompt-Typ

Bausteine:

- `src/server/lib/push-config.mjs`
  - SSOT für lokale Push-Settings
  - Daily-Prompt-Definitionen
  - Action-/Intent-URLs
- `src/server/services/push-scheduler.mjs`
  - lokaler Scheduler für Supplements plus Daily Prompts
- `src/server/routes/push.mjs`
  - lokale Settings-API
  - lokaler Test-Trigger `POST /push/test`
- `public/sw.js`
  - rendert Notification-Actions
  - navigiert in Intent-Ziele statt nur auf rohe Tabs
- `functions/index.js`
  - Cloud-Scheduler liest `users/{uid}/meta/settings`
  - FCM-Token aus `users/{uid}/fcm/token`

Aktuelle Daily-Prompt-Typen in Fuel:

- `fuel_quick_log`
  - öffnet den AI-Freitext-Logger
  - Actions: `Quick Log`, `Log`, `Journal`
- `journal_entry`
  - öffnet die Tagesnotizen
  - Actions: `Jetzt schreiben`, `Food Log`

Intent-Schema:

- Query-Parameter:
  - `notificationTab`
  - `notificationDate`
  - `notificationIntent`
  - `notificationFocus`
  - optional `notificationDraft`
- Frontend-Bridge:
  - `src/client/lib/notification-intents.js`
  - speichert den Intent kurz in `sessionStorage`
  - setzt Tab/Datum sofort
  - übergibt den Fokus an die Ziel-View

Wichtige Einschränkung:

- Auf der Web/PWA-Schicht gibt es kein verlässliches plattformübergreifendes
  echtes Freitext-Reply wie in nativen Messenger-Notifications.
- Daher ist `reply_mode=deep-link` aktuell der ehrliche Modus:
  Notification -> Action -> fokussierter Composer in der App.
- Wenn später ein nativer Wrapper oder Android-spezifischer Kanal dazukommt,
  kann derselbe Intent-Name (`fuel.quick-log`, `journal.quick-entry`, ...)
  auf echtes Inline-Reply gemappt werden.

Analoge Zieltypen für die anderen VitalOS-Apps:

- Fitness
  - Prompt: nächster Trainingsblock laut User-Präferenz (`PPL`, `UL`, `FB`)
  - Intent: `fitness.next-block`
  - Actions: `Start Session`, `Swap Block`, `Skip Today`
- Journal
  - Prompt: Tages-Check-in
  - Intent: `journal.quick-entry`
  - Actions: `1 Satz schreiben`, `Mood`, `Heute reviewen`
- Habits
  - Prompt: due Habits oder Supplements
  - Intent: `habits.daily-checkin`
  - Actions: `Done`, `Snooze`, `Open Stack`
- Fuel
  - Prompt: Mahlzeit als Freitext loggen
  - Intent: `fuel.quick-log`
  - Actions: `Quick Log`, `Log`, `Journal`

Die beabsichtigte gemeinsame Struktur ist also nicht ein global gemeinsamer
Catalog, sondern ein gemeinsames Notification-/Intent-Protokoll über
app-spezifische Datenmodelle hinweg.

## Known Incident: Multi-User Runtime Leak

Am 2026-08-31 wurde ein echter Multi-User-Leak bestätigt.

Symptom:

- Jakobs Meals landeten in einem anderen Firestore-User
- konkret wurde mindestens der Tag `2026-08-29` verdächtig
- Jakobs lokaler User `fxohGl4Zn5ZUqXzTHjBsye5MmFu1` hatte dort:
  - `Reis mit Gemüse und Falafel`
  - `Feta Wrap mit Bohnensalat`

Root cause:

1. Die Nutrition Runtime-DB war noch global verdrahtet statt user-scoped.
2. Mehrere Runtime-Pushpfade gaben die echte `uid` nicht explizit weiter.
3. Dadurch konnten gepullte Userdaten wieder über `FUEL_CLOUD_UID` in den
   falschen Firestore-User zurückgeschrieben werden.

Fix:

- `src/server/services/nutrition-db.mjs` auf user-scoped DB-Kontext umgestellt
- Runtime-Pushes für nutrition logs und journal auf explizite `uid`
- Firestore-Pull schreibt pro User wieder in dessen eigene DB/Journal-Pfade

Commit:

- `74947ad` `Fix fuel runtime sync user isolation`

Der Fix verhindert neue Vermischungen. Bereits verfälschte Firestore-Dokumente
müssen separat per Recovery bereinigt werden.

## Fitness Bridge

`fitness-dev` kann Fuel-Daten bridgen, aber diese Brücke ist nicht der primäre
Fuel-Sync-Owner.

Regeln:

- Fuel bleibt Owner seiner eigenen user-scoped Catalogs
- Fitness darf Fuel nicht auf globale Catalog-Semantik herunterbrechen
- die Repo-Bridge muss deaktivierbar bleiben

Das wurde in `fitness-dev` über ein abschaltbares Env-Flag umgesetzt.

## Invariants

Diese Regeln gelten als Architektur-Invarianten:

1. `default` bleibt lokal-only.
2. Fuel-Catalogs sind user-spezifisch, nicht global.
3. Runtime-Logs, Journal und SQLite müssen pro User isoliert sein.
4. Jeder Cloud-Write braucht eine explizite echte `uid`.
5. Dev und Prod dürfen nicht beide standardmäßig denselben Firestore-Sync fahren.
6. Tombstones gewinnen gegen ältere oder doppelte Remote-Daten.
7. Server-Logs müssen `uid` und Richtung des Syncs sichtbar machen.

## Relevant Files

- `src/server/app.mjs`
- `src/server/config/paths.mjs`
- `src/server/lib/client-manager.mjs`
- `src/server/lib/firestore-admin.mjs`
- `src/server/services/nutrition-db.mjs`
- `src/server/services/nutrition-catalog.mjs`
- `src/server/services/supplements-catalog.mjs`
- `src/server/services/supplements-log.mjs`
- `src/server/services/log-tombstones.mjs`
- `src/server/routes/nutrition/log.mjs`
- `src/server/routes/nutrition/notes.mjs`
- `src/server/routes/supplements.mjs`
- `src/server/routes/coach.mjs`
