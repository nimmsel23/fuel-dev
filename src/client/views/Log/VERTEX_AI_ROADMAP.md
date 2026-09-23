# Roadmap: Vertex AI for Firebase Integration

Stand 2026-09-23: Die Browser-Integration ist implementiert. Die verbleibenden Punkte betreffen Betriebssicherung und Offline-Verhalten. Der Scanner erkennt Barcodes nur als Teil eines Fotos per Modell; eine eigene Barcode-Erkennung oder Produktdatenbank-Abfrage gibt es nicht.

## 📌 Aktueller Stand
- Im **lokalen Modus** (`VITE_APP_MODE=coach`) läuft ein Node-Server (`server.mjs`), der per Fastify die Route `POST /nutrition/vision` bereitstellt.
- Diese Route spricht im Hintergrund unseren neuen lokalen Python-Server (`fuel-catalog-server.py` via FastAPI) an, welcher wiederum über `fuel/gemini.py` sicher mit Gemini kommuniziert.
- Im **Cloud Modus** (`VITE_APP_MODE=client` via Firebase Hosting) verwenden Scanner, AI-Logger und Supplement-Schätzung `firebase/vertexai` direkt im Browser. Ein `GEMINI_API_KEY` wird dafür nicht ins Frontend gepackt.

## 🎯 Das Ziel
Wir wollen den `ScannerModal.jsx` (und später auch `GeminiCatalogModal.jsx`) so umbauen, dass er im Cloud-Modus **direkt aus dem Browser** mit Gemini kommunizieren kann, ohne dass ein eigener Server betrieben werden muss.
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
- [ ] **Caching von Barcodes:** Ein lokales Cache-System (z.B. IndexedDB) einführen, sodass ein bereits gescannter Barcode sofort aus dem Speicher geladen wird, ohne dass Vertex AI noch einmal kontaktiert werden muss (spart Zeit und API-Kosten).
- [ ] **Offline-Warteschlange für KI-Anfragen:** `public/offline-queue.js` puffert lokale HTTP-POSTs, aber keine direkten Vertex-AI-Aufrufe im Cloud-Client. Für Scans/Prompts braucht es eine gesonderte, nutzergebundene Queue mit sichtbarem Status.

### Phase 6: UX Polish (Benutzererlebnis)
- [ ] **Streaming Responses prüfen:** Für strukturierte JSON-Nährwerte erst einen sinnvollen Vorschau-Flow definieren; rohe JSON-Fragmente sollten nicht als Nährwerte angezeigt werden.
- [ ] **Erweitertes Kamera-Feedback:** Dem Scanner visuelle Indikatoren (z.B. einen Rahmen, der Barcodes oder Essen fokussiert) hinzufügen.

## 🚀 Fazit
Die Cloud-PWA benötigt für neue KI-Schätzungen eine Verbindung zu Firebase AI Logic. Offline-Nutzung ist erst mit einem gesonderten Queue- und Wiederaufnahme-Flow für diese Anfragen möglich.
