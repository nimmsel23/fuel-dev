# Finale Variante `vos-fuel`

Stand 2026-11-12. Konzept, keine Umsetzung. Analog `~/vitalos/prod/vos-fitness`
(schlanker Wrapper über die App-Quellen, eigene Site, nur nötige Bausteine).

## Zweck
Eine live Fuel-Fläche für Endnutzer, die einfach funktioniert, auch wenn die VitalOS-Shell
oder `fuel-vos` gerade nicht gesund sind. Fuel im Store-Umfang: loggen, nachschlagen,
auswerten. Keine KI, keine Coach-/Owner-Werkzeuge. Hosting-Kanon: `https://vos-fuel.web.app`
(Site-ID `vos-fuel`, siehe `~/vitalos/docs/HOSTING-TARGETS.md`; nie wieder `fuel-aos`).

## Umfang (Views aus `src/client`, nichts kopiert)
| Bereich | Quelle | Anmerkung |
|---|---|---|
| Log (Barcode, Food-Suche, manuell) | `views/Log` | Barcode und Suche via Open Food Facts, keine Nutzerdaten |
| Schnellwahl | `views/Frontdoor/TapBoardFrontdoor` | Standard-Einstieg |
| Tagesübersicht, Tagesverlauf | `LogView` (Modus) | |
| Lebensmittel und Katalog, Historie | `FoodView`, `CatalogView`, `HistoryView` | leerer Zustand mit Anleitung |
| Nahrungsergänzung, Mikronährstoffe | `SupplementsView`, `MicrosView` | ohne AI Coach und Lückenschätzer |
| Töpfe, Einkaufszettel/Vorrat | `PotsView`, `KitchenView` | ohne Bon-Scan, Aktionen, Rezeptideen |
| Einstellungen | `SettingsView` | Ziele, Profil, Backup, Konto, Erinnerungen |

Nicht enthalten: Shutter, Tagesfaden, Gemini-Dialoge, Lernmodul, Dev-Tab, Fasten, Protokoll-Report
(Report später prüfen, kein KI-Bezug). Steuerung zentral über `AI_ENABLED` und `STORE_BUILD`
(`lib/aiAvailability.js`, `lib/cloudEnv.js`); der Wrapper setzt `VITE_VOS_EDITION=store`
und `VITE_VOS_PRODUCT_BUILD=1`.

## Login und Offline
- Google-Login über Firebase Auth, Projekt `vitalos-prod`; Gate nur beim ersten Start.
  Mit gespeicherter Sitzung öffnet die App ohne Netz direkt (Auth-Persistenz lokal).
- Daten: Firestore mit Offline-Persistenz plus Outbox (`lib/cloudOutbox*.js`); Schreiben
  offline wird nachgeholt. Barcode-Treffer 30 Tage im localStorage-Cache.
- Service Worker aus `@vos/mini-app-shell` (`stamp:sw`), Update per Button, kein Auto-Reload.
- Zu prüfen vor Release: Kaltstart ohne Netz und ohne Sitzung zeigt Login-Hinweis statt Weißbild.

## Build-Weg
- Neuer Ordner `~/vitalos/prod/vos-fuel/` (Muster `vos-fitness` und `vos-fuel-mini`):
  `vite.config.cjs` lädt `../fuel-app/vite.config.cjs`, biegt `root`/`outDir` um
  (`vos-fuel/dist-firebase`), Produkt-Firebase-Config per `productFirebaseConfig`-Plugin.
- Eigener schmaler Einstieg `vos-fuel/src/main.jsx` mit Tab-Leiste über `@fuel/routes`
  (statt `main.jsx` aus fuel-dev mit "Control Deck"-Kopf).
- Build vom Meta-Root: `pnpm --filter @vitalos/product run build:fuel:product` (neu);
  Deploy über `firebase.product-fuel.json` (Target `fuel-product` → Site `vos-fuel`).
  Ein Build beauftragt keinen Deploy. Shared-Code aus `~/dev/backend` (SOT).
- Quelle bleibt `fuel-dev` (`dev` → `master`, Shell-Pin). Keine zweite Fuel-Implementierung.

## Abgrenzung
- **Mini-Apps** (`vos-fuel-log|supplements|mikros|protokoll`): stabile Fallbacks, eigene Sites,
  eigener Deploy (`miniapps.json`). Später Subrouten `vos-fuel.web.app/mini/<id>` (Kanon),
  nicht Teil des ersten `vos-fuel`-Deploys.
- **fuel-os**: alter fuelctx-Stand, bleibt eingefroren, kein Traffic mehr, nicht überschreiben.
- **fuel-vos** (Standalone `client`): Owner-/Entwicklungsfläche mit allen Tabs und KI;
  Redirect `fuel-vos` → `vos-fuel` erst nach verifiziertem Store-Umfang.
- **VitalOS-Shell**: bettet Fuel per Alias ein; die Shell-Nav (SUB_NAV.fuel) bleibt Sache der Shell.

## Offene Entscheidungen
1. Küche (Einkaufszettel) im ersten Release oder erst nach Closed Test.
2. OAuth-Triplet für `vos-fuel` (Auth Domain, JS-Origin, Redirect-URI) vor dem ersten Deploy.
3. Open Food Facts in der Data-Safety-Erklärung nennen (Barcode und IP gehen an Dritte).
