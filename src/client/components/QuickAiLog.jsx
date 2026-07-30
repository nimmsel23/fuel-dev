import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, RotateCcw } from "lucide-react";
import { postJson } from "@api";

const isCloud = () =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com"));

// Kompaktes Freitext-Log-Widget fürs Dashboard — leichte Variante des
// vollen AI-Log-Flows in Log/LogView.jsx (kein Katalog-Match, kein
// optimistisches Pending-Entry-Handling, kein Supplement-Auto-Log). Für
// den schnellen "2 Eier mit Toast" Fall auf der Startseite, nicht als
// Ersatz für den Log-Tab gedacht.
export default function QuickAiLog({ date }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    const raw = text.trim();

    try {
      if (isCloud()) {
        const [{ vertexAI }, { getGenerativeModel }, { withAiRetry }, firestore] = await Promise.all([
          import("../lib/firebase.js"),
          import("firebase/vertexai"),
          import("../lib/aiRetry.js"),
          import("../lib/db.firestore.js"),
        ]);
        const model = getGenerativeModel(vertexAI, {
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" },
        });
        const prompt = `Analysiere folgenden Freitext und extrahiere die Mahlzeit + geschätzte Makros. Gib AUSSCHLIESSLICH ein JSON-Objekt zurück:
{"description":"Zusammenfassung","type":"breakfast|lunch|dinner|snack","kcal":<Zahl>,"protein":<Zahl>,"carbs":<Zahl>,"fat":<Zahl>}

Text: ${raw}`;
        const result = await withAiRetry(() => model.generateContent(prompt));
        const item = JSON.parse(result.response.text());

        const existing = await firestore.getNutritionLog(date);
        const meal = {
          id: `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          ...item,
          logged_at: new Date().toISOString(),
        };
        existing.meals = [...(existing.meals || []), meal];
        await firestore.saveNutritionLog(date, existing);
      } else {
        await postJson("/nutrition/ai-log", { text: raw, date });
      }

      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      setText("");
    } catch (err) {
      console.error("QuickAiLog error:", err);
      setError(err.message || "Fehler beim KI-Logging.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-semibold">Schnell loggen</h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-400"
          placeholder="z.B. 2 Eier mit Toast und Butter"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="shrink-0 rounded-2xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-40"
        >
          {loading ? "Verarbeite…" : "Loggen"}
        </button>
      </div>
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/20 px-2 py-1 font-semibold hover:bg-rose-500/30"
          >
            <RotateCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
    </form>
  );
}
