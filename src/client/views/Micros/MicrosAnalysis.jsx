import React, { useState, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { vertexAI } from "../../lib/firebase.js";
import { getGenerativeModel } from "firebase/vertexai";
import { NUTRIENTS } from "./utils.js";

// Optional: Fallback to local server if not cloud
const isCloud = () => window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

export default function MicrosAnalysis({ weeks, results, onClose }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only analyze if results are fully loaded
    const isReady = results.every(r => !r.isPending);
    if (isReady) {
      analyzeData();
    }
  }, [results.every(r => r.isPending)]);

  async function analyzeData() {
    setLoading(true);
    setError(null);
    try {
      // 1. Format the data
      let dataText = "Nutrition Data (Weekly Averages vs DACH %):\n\n";
      weeks.forEach((w, wi) => {
        dataText += `Week ${w.year}-W${w.week}:\n`;
        const res = results[wi];
        if (!res || !res.data) {
          dataText += "  No data\n";
          return;
        }
        NUTRIENTS.forEach(({ key, label }) => {
          const pct = res.data.rda_comparison?.[key]?.percent_of_dach;
          if (pct != null) {
            dataText += `  - ${label}: ${pct}%\n`;
          }
        });
      });

      const prompt = `
Du bist ein professioneller, motivierender Ernährungsberater.
Hier sind die Mikronährstoff-Level der letzten ${weeks.length} Wochen eines Users (als % der empfohlenen DACH-Tagesmenge).

Daten:
${dataText}

Aufgabe:
Analysiere die Daten und schreibe eine kurze, prägnante Zusammenfassung.
- Welche Nährstoffe sind chronisch zu niedrig?
- Welche sind gut abgedeckt?
- Gib 2-3 konkrete, alltagstaugliche Lebensmittel-Empfehlungen (z.B. "Iss mehr Nüsse für Zink"), um die Lücken zu füllen.
Antworte in Markdown, halte es kurz, positiv und direkt anwendbar. Keine ärztliche Beratung, nur Food-Tipps!
`;

      if (isCloud() && vertexAI) {
        const model = getGenerativeModel(vertexAI, { model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        setAnalysis(result.response.text());
      } else {
        // Fallback for local coach mode (stub)
        setAnalysis("Lokaler Modus: Vertex AI API ist aktuell nur im Cloud-Build aktiv. Bitte auf Firebase testen oder Backend-Endpoint ergänzen!");
      }
    } catch (err) {
      console.error(err);
      setError("Analyse fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2 text-violet-400">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-semibold text-slate-100">Vertex Analyse</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-4" />
              <p>Analysiere deine Mikronährstoffe der letzten Wochen...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
              {error}
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
