# Roadmap: Vertex Analyse für Mikronährstoffe

Dieses Dokument beschreibt das geplante Addon-Upgrade für den `MicrosView`. Ziel ist es, aus den aggregierten Daten der Mikronährstoff-Heatmap per Knopfdruck personalisierte Empfehlungen (Bloodwork/Dietary Analysis) mithilfe von Vertex AI (Gemini 1.5 Flash) im Cloud-Modus direkt im Browser zu generieren.

## 📌 Aktueller Stand
- Die `MicrosView.jsx` stellt aktuell die wöchentlichen Durchschnitte der Mikronährstoffe vs. DACH-Referenzwerte in einer Heatmap dar (`MicrosGrid`).
- Es fehlt eine interpretative Analyse, welche Nährstoffe systematisch fehlen und welche Lebensmittel (z.B. Nüsse, Gemüse) diese Lücken schließen könnten.

## 🎯 Das Ziel
Wir wollen einen "Analyse"-Button im `MicrosView.jsx` integrieren. Dieser Button sammelt die lokal gerenderten Wochen-Daten, verpackt sie in einen Kontext-Prompt und bittet Vertex AI über das `@firebase/vertexai` Web SDK um konkrete Handlungs- bzw. Ernährungsempfehlungen.

## 🗺️ Meilensteine & Schritte

### Phase 1: Datenaufbereitung & Prompting
- [ ] **Daten-Extraktion:** Funktion schreiben, welche die wöchentlichen Nährstoffdaten in ein flaches, für die KI verständliches Format überführt (z.B. CSV-artig oder kompaktes JSON).
- [ ] **System-Prompt entwerfen:** Den optimalen System-Prompt schreiben, um Gemini in die Rolle eines Ernährungsberaters zu versetzen. (Ziel: Fokus auf wiederkehrende Lücken, Lebensmittelvorschläge, keine Panikmache, motivierender Ton).

### Phase 2: Frontend-Integration (UI & Vertex AI)
- [ ] **Analyse Button & Modal:** Einen "Analyse"-Button in `MicrosView.jsx` hinzufügen, der einen Overlay/Dialog öffnet.
- [ ] **Vertex AI Anbindung:** Die Logik aus dem `ScannerModal.jsx` übernehmen (Hybrid-Modus):
  - Lokaler Modus (`VITE_APP_MODE=coach`): Daten an lokalen Python-Backend-Endpunkt schicken (muss ggf. in `server.mjs` / `fastapi` ergänzt werden).
  - Cloud Modus (`VITE_APP_MODE=client`): Daten direkt an `getGenerativeModel` aus `firebase/vertexai` schicken.
- [ ] **Lade- & Streaming-Status:** Einen schönen Ladezustand einbauen (Spinner/Skeleton) oder im besten Fall direkt *Streaming Responses* nutzen, damit der Text sofort beginnt einzufliegen.

### Phase 3: Optimierung
- [ ] **Structured Outputs / Fallbacks:** Wenn gewünscht, die Antwortform in Markdown-Blocks gliedern lassen, um sie mit `react-markdown` sauber zu rendern.
- [ ] **Caching:** Die AI-Analyse für eine bestimmte Woche (z.B. KW 32) cachen, damit nicht bei jedem Aufruf erneut Kosten anfallen, solange sich die Log-Daten nicht signifikant geändert haben.

## 🚀 Fazit
Mit diesem Feature wird der Micros Tab von einer reinen Reporting-Ansicht zu einer proaktiven, KI-gestützten Analyse, die dir hilft, deine Mängel zielgerichtet über die Ernährung auszugleichen.
