# Roadmap: Vertex AI for Firebase Integration

Stand 2026-10-30 (lokaler Quellstand, noch kein Release): Die Browser-Integration ist implementiert. Die verbleibenden Punkte betreffen Betriebssicherung und Offline-Verhalten. Update 2026-10-16: Der Scanner hat einen eigenen Barcode-Modus mit nativer EAN/UPC-Fotodecodierung, Nummerneingabe als Browser-Fallback, Open-Food-Facts-Produktabfrage und 30-Tage-Cache. Essens-/Etikettfotos bleiben ein separater KI-Ablauf.

## 📌 Aktueller Stand
- Im **lokalen Modus** (`VITE_APP_MODE=coach`) läuft ein Node-Server (`server.mjs`), der per Fastify die Route `POST /nutrition/vision` bereitstellt.
- Diese Route spricht im Hintergrund unseren neuen lokalen Python-Server (`fuel-catalog-server.py` via FastAPI) an, welcher wiederum über `fuel/gemini.py` sicher mit Gemini kommuniziert.
- Im **Cloud Modus** (`VITE_APP_MODE=client` via Firebase Hosting) verwenden Scanner, AI-Logger und Supplement-Schätzung `firebase/vertexai` direkt im Browser. Ein `GEMINI_API_KEY` wird dafür nicht ins Frontend gepackt.

## 🎯 Das Ziel
Wir wollen den `ScannerModal.jsx` (und später auch `GeminiCatalogModal.jsx`) so umbauen, dass er im Cloud-Modus **direkt aus dem Browser** mit Gemini kommunizieren kann, ohne dass ein eigener Server betrieben werden muss. Scanner und Shutter teilen jetzt `ScannerModal.jsx` und `lib/visionScan.js`.
Dies wird durch das offizielle **Vertex AI for Firebase Web SDK** (`@firebase/vertexai`) realisiert, welches den API-Schlüssel verbirgt und durch **Firebase App Check** abgesichert ist.

## 🗺️ Meilensteine & Schritte

### Phase 1: Firebase Projekt-Setup (Google Cloud)
- [x] **Vertex AI API aktivieren:** In der Google Cloud Console für das Projekt `fitness-aos` die Vertex AI API freischalten.
- [ ] **Firebase App Check im Projekt verifizieren:** Der Client initialisiert reCAPTCHA v3 mit `VITE_RECAPTCHA_SITE_KEY`. Registrierung, Enforcement und echte Token im Firebase-Projekt sind aus dem Repo allein nicht nachweisbar.
- [x] **Abrechnung/Quotas prüfen:** Da Vertex AI über Google Cloud abgerechnet wird (Blaze-Plan erforderlich), Quotas und Sicherheitsregeln prüfen.

### Phase 2: Frontend-Integration (`firebase/vertexai`)
- [x] **Abhängigkeit installieren:** `npm install @firebase/vertexai` (wird über `firebase/vertexai` importiert)
- [x] **Initialisierung anpassen:** In `src/client/lib/firebase.js` das Vertex AI SDK initialisieren:
  ```javascript
  import { getVertexAI } from "firebase/vertexai";
  // Nach initializeApp(firebaseConfig)...
  export const vertexAI = getVertexAI(app);
  ```
- [x] **App Check clientseitig initialisieren:** `firebase.js` ruft `initializeAppCheck` im Client-Build auf, wenn `VITE_RECAPTCHA_SITE_KEY` gesetzt ist. Die Projektseite bleibt separat zu prüfen.

### Phase 3: Komponenten-Upgrade (`ScannerModal.jsx`)
- [x] **Umgebungsweiche (Hybrid-Modus):** Die Logik in `ScannerModal.jsx` anpassen, sodass sie je nach `import.meta.env.VITE_APP_MODE` reagiert:
  - `VITE_APP_MODE === 'coach'`: Nutze weiterhin `postJson("/nutrition/vision")` (lokales Python-Backend).
  - `VITE_APP_MODE === 'client'`: Nutze `getGenerativeModel(vertexAI, { model: "gemini-2.5-flash" })` direkt im Client.
- [x] **Bild-Übergabe:** Die Client-Logik so umschreiben, dass das lokal via Canvas komprimierte Base64-Bild direkt in das von Vertex AI verlangte Inline-Data-Format (`{ inlineData: { data: base64, mimeType: "image/jpeg" } }`) verpackt wird.

### Phase 4: Ausweitung auf weitere KI-Funktionen
- [x] `GeminiCatalogModal.jsx` für Supplements nutzt im Cloud-Modus Vertex AI.
- [x] Den AI-Logger in der `LogView.jsx` (der aktuell im Cloud-Modus komplett ausgeblendet wird) ebenfalls über Vertex AI im Browser wieder freischalten.

### Phase 5: Reliability & Robustness (Verlässlichkeit)
- [x] **Structured Outputs:** Scanner, AI-Logger und Supplement-Schätzung nutzen `responseMimeType: "application/json"` und `responseSchema` mit `gemini-2.5-flash`. JSON-Parsing und fachliche Prüfung der Antwort bleiben erforderlich.
- [x] **Fehlerbehandlung & Retry:** `withAiRetry` wiederholt transiente Fehler; Scanner, AI-Logger und Supplement-Modal zeigen Fehler mit einer Wiederholen-Aktion.
- [x] **Caching von Barcodes (2026-10-16, `lib/barcode.js`):** Öffentliche OFF-Produktdaten liegen 30 Tage in localStorage; bekannte Produkte brauchen weder Gemini noch Netzwerk. Native Barcode-Fotodecodierung ist browserabhängig, Nummerneingabe bleibt der Fallback.
- [x] **Offline-Foto-Warteschlange (2026-10-30):** `scanQueue.js` speichert Fotos mit Konto, ursprünglichem Log-Tag und Scan-Typ in IndexedDB. Im Scanner werden Status, Datum, Analysieren und Entfernen angezeigt. Offline-Fotos landen dort automatisch; nach Online-Analysefehlern kann das Foto ausdrücklich gesichert werden. Fortsetzen erfolgt bewusst bei Verbindung und passendem ausgewähltem Log-Tag, ohne automatisches Meal-Logging. Fotos anderer Tage werden mit Hinweis angezeigt. Maximal 12 Fotos mit je 8 MB pro Konto/Gerät; Speicherfehler bleiben sichtbar. Erfolgreich übernommene Ergebnisse verlassen die Warteliste und bleiben zunächst ein editierbarer Entwurf. Normale Formularentwürfe sind nicht dauerhaft gesichert.
- [x] **Bekanntes Essen ohne KI:** Explizite Katalogsuche im Scanner vor dem Scan; kein angeblicher automatischer Namensabgleich vor Bilderkennung.
- [x] **Zutaten/Portionen:** Foto-Schema fordert Hauptzutaten mit Mengen und Makros; gemeinsame Normalisierung (`mealComponents.js`) mit dem Text-Logger, Zutatenmenge und Zutatenmakros skalieren mit der Portion.
- [x] **Bildqualität:** Essen 1280 px/0,82; Etikett/Beleg 2048 px/0,92. Auswahl im gemeinsamen Scanner-Dialog, Barcode-Decodierung erhält das Originalbild.

### Phase 6: UX Polish (Benutzererlebnis)
- [ ] **Streaming Responses prüfen:** Für strukturierte JSON-Nährwerte erst einen sinnvollen Vorschau-Flow definieren; rohe JSON-Fragmente sollten nicht als Nährwerte angezeigt werden.
- [ ] **Erweitertes Kamera-Feedback:** Dem Scanner visuelle Indikatoren (z.B. einen Rahmen, der Barcodes oder Essen fokussiert) hinzufügen.

## 🚀 Fazit
Die Cloud-PWA benötigt für neue KI-Schätzungen eine Verbindung zu Firebase AI Logic. Fotos können offline auf diesem Gerät gesichert und später im selben Konto und am ursprünglichen Log-Tag bewusst analysiert werden. Es werden keine Mahlzeiten oder Micros vor der Bestätigung gespeichert.

App Check: Der lokale Build hat einen Site-Key. Die drei CI-Workflows reichen nun die GitHub-Variable (alternativ Secret) `VITE_RECAPTCHA_SITE_KEY` weiter. Ob diese im Repo gesetzt und für die jeweiligen Hosting-Domains registriert ist, sowie Projekt-Enforcement und echte Tokens bleiben zu prüfen. Der Versuch einer rein lesenden Projektprüfung hatte hier keinen nutzbaren gcloud-Zugriffstoken. Keine App-Check-Projekteinstellungen verändert.

Verifikation und Grenzen siehe `RESULTS.md`, Eintrag 2026-10-30. Kein Push/Deploy ohne ausdrückliche Freigabe.
