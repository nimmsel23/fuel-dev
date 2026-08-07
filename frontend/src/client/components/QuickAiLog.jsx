import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, RotateCcw } from "lucide-react";
import { postJson } from "@api";

// Kompaktes Freitext-Log-Widget fürs Dashboard — direkter POST an
// /nutrition/log {text, date}, Backend (backend/api/endpoints/food.py)
// macht Catalog-Match bzw. Gemini-Makro-Extraktion serverseitig selbst.
// Portiert aus fuel-dev (dort zusätzlich ein Cloud/Firestore-Zweig, den es
// hier bewusst nicht gibt — backend/ ist Firestore-frei).
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
      await postJson("/nutrition/log", { text: raw, date });
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
