# Roadmap: Vertex AI for Firebase Integration

Dieses Dokument beschreibt das geplante Addon-Upgrade, um die KI-Funktionen (insbesondere den neuen Foto-/Barcode-Scanner) komplett "Serverless" im Cloud-Modus der Fuel App zu betreiben.

## 📌 Aktueller Stand
- Im **lokalen Modus** (`VITE_APP_MODE=coach`) läuft ein Node-Server (`server.mjs`), der per Fastify die Route `POST /nutrition/vision` bereitstellt.
- Diese Route spricht im Hintergrund unseren neuen lokalen Python-Server (`fuel-catalog-server.py` via FastAPI) an, welcher wiederum über `fuel/gemini.py` sicher mit Gemini kommuniziert.
- Im **Cloud Modus** (`VITE_APP_MODE=client` via Firebase Hosting) fehlt dieses Backend. Der API-Key (`GEMINI_API_KEY`) darf aus Sicherheitsgründen nicht direkt ins React-Frontend gepackt werden.

## 🎯 Das Ziel
Wir wollen den `ScannerModal.jsx` (und später auch `GeminiCatalogModal.jsx`) so umbauen, dass er im Cloud-Modus **direkt aus dem Browser** mit Gemini kommunizieren kann, ohne dass ein eigener Server betrieben werden muss.
Dies wird durch das offizielle **Vertex AI for Firebase Web SDK** (`@firebase/vertexai`) realisiert, welches den API-Schlüssel verbirgt und durch **Firebase App Check** abgesichert ist.

## 🗺️ Meilensteine & Schritte

### Phase 1: Firebase Projekt-Setup (Google Cloud)
- [x] **Vertex AI API aktivieren:** In der Google Cloud Console für das Projekt `fitness-aos` die Vertex AI API freischalten.
- [ ] **Firebase App Check aktivieren:** App Check im Firebase Dashboard konfigurieren (z.B. mit reCAPTCHA Enterprise für Web), um Anfragen abzusichern. *(Muss noch manuell in der Firebase Console eingerichtet werden)*
- [x] **Abrechnung/Quotas prüfen:** Da Vertex AI über Google Cloud abgerechnet wird (Blaze-Plan erforderlich), Quotas und Sicherheitsregeln prüfen.

### Phase 2: Frontend-Integration (`firebase/vertexai`)
- [x] **Abhängigkeit installieren:** `npm install @firebase/vertexai` (wird über `firebase/vertexai` importiert)
- [x] **Initialisierung anpassen:** In `src/client/lib/firebase.js` das Vertex AI SDK initialisieren:
  ```javascript
  import { getVertexAI } from "firebase/vertexai";
  // Nach initializeApp(firebaseConfig)...
  export const vertexAI = getVertexAI(app);
  ```
- [ ] **App Check initialisieren:** In `firebase.js` App Check einbauen, bevor Vertex AI aufgerufen wird.

### Phase 3: Komponenten-Upgrade (`ScannerModal.jsx`)
- [x] **Umgebungsweiche (Hybrid-Modus):** Die Logik in `ScannerModal.jsx` anpassen, sodass sie je nach `import.meta.env.VITE_APP_MODE` reagiert:
  - `VITE_APP_MODE === 'coach'`: Nutze weiterhin `postJson("/nutrition/vision")` (lokales Python-Backend).
  - `VITE_APP_MODE === 'client'`: Nutze `getGenerativeModel(vertexAI, { model: "gemini-1.5-flash" })` direkt im Client.
- [x] **Bild-Übergabe:** Die Client-Logik so umschreiben, dass das lokal via Canvas komprimierte Base64-Bild direkt in das von Vertex AI verlangte Inline-Data-Format (`{ inlineData: { data: base64, mimeType: "image/jpeg" } }`) verpackt wird.

### Phase 4: Ausweitung auf weitere KI-Funktionen
- [ ] Das `GeminiCatalogModal.jsx` für Supplements nach dem exakt gleichen Prinzip auf Vertex AI umbauen, damit der Cloud-Modus wieder vollen KI-Zugriff hat.
- [x] Den AI-Logger in der `LogView.jsx` (der aktuell im Cloud-Modus komplett ausgeblendet wird) ebenfalls über Vertex AI im Browser wieder freischalten.

### Phase 5: Reliability & Robustness (Verlässlichkeit)
- [ ] **Structured Outputs (JSON Schema):** Das manuelle Text-Parsing (`replace(/```json/g)`) durch das offizielle `responseSchema` Feature von Gemini 1.5 ersetzen. Dadurch garantiert die API ein valides JSON-Objekt ohne Halluzinationen oder fehlerhaftes Escaping.
- [ ] **Fehlerbehandlung & Retry-Logik:** Netzwerkausfälle oder Timeout-Fehler von Vertex AI elegant abfangen. Bei einem Fehler sollte der Nutzer einen klaren Hinweis erhalten und die Anfrage mit einem Klick wiederholen können.
- [ ] **Caching von Barcodes:** Ein lokales Cache-System (z.B. IndexedDB) einführen, sodass ein bereits gescannter Barcode sofort aus dem Speicher geladen wird, ohne dass Vertex AI noch einmal kontaktiert werden muss (spart Zeit und API-Kosten).
- [ ] **Offline-Warteschlange (Queue):** Wenn das Handy offline ist, Scans/Prompts lokal zwischenspeichern und automatisch abarbeiten lassen, sobald die Firebase-Verbindung wieder steht.

### Phase 6: UX Polish (Benutzererlebnis)
- [ ] **Streaming Responses:** Die Vertex AI Streaming API (`generateContentStream`) nutzen, um Nährwerte Buchstabe für Buchstabe einfliegen zu lassen, anstatt auf das finale JSON warten zu müssen.
- [ ] **Erweitertes Kamera-Feedback:** Dem Scanner visuelle Indikatoren (z.B. einen Rahmen, der Barcodes oder Essen fokussiert) hinzufügen.

## 🚀 Fazit
Mit diesem Upgrade wird die Firebase-PWA zu 100% autark und hochzuverlässig. Foto-Uploads, Barcode-Scans und Text-Log-Schätzungen funktionieren dann direkt offline/mobil über das Web-Frontend sicher und stabil per Google Cloud.
