import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { Field, MealRow, Empty } from "../components/ui.jsx";
import { postJson } from "../lib/api.js";

export default function JournalView({ date, nutrition, journal }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const meals = nutrition?.meals || [];

  const handleLog = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);

    try {
      // Dispatcher route: AI decides action based on text
      const result = await postJson("/nutrition/ai-log", { text, date });
      
      if (result.type === "meal" || result.type === "catalog") {
        queryClient.invalidateQueries({ queryKey: ["nutrition", date] });
        queryClient.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["journal", date] });
      }
      setText("");
    } catch (err) {
      console.error("AI Logging error:", err);
      alert("Fehler bei der Verarbeitung.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6">
      {/* Unified AI Dispatcher */}
      <form onSubmit={handleLog} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Dispatcher</h2>
            <p className="text-sm text-slate-400">Eingabe: Log, Journal oder Katalog-Enrichment.</p>
          </div>
          <NotebookPen className="h-5 w-5 text-sky-300" />
        </div>
        
        <textarea 
          className="min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="z.B. 'Ich habe einen Döner gegessen' oder 'Füge Döner zum Katalog hinzu mit 800kcal, 40g Protein' oder 'Heute war ein guter Tag'"
        />
        
        <button disabled={loading || !text.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
          {loading ? "Verarbeite..." : "Absenden"}
        </button>
      </form>

      {/* Latest meals */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <h3 className="mb-4 text-lg font-semibold">Heutige Logs</h3>
        <div className="grid gap-3">
          {meals.length ? meals.slice().reverse().map((meal) => <MealRow key={meal.id} meal={meal} />) : <Empty text="Keine Einträge heute." />}
        </div>
      </section>
    </section>
  );
}
