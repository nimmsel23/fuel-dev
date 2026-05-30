import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { Field, Empty } from "../components/ui.jsx";
import { postJson } from "../lib/api.js";

export default function JournalView({ date, journal }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(journal || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postJson("/nutrition/journal", { date, content: text });
      queryClient.invalidateQueries({ queryKey: ["journal", date] });
    } catch (err) {
      console.error("Journal save error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6">
      <form onSubmit={handleSave} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Journal</h2>
          <NotebookPen className="h-5 w-5 text-sky-300" />
        </div>
        
        <textarea 
          className="min-h-80 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Tagebucheintrag für heute..."
        />
        
        <button disabled={loading} className="mt-4 rounded-full bg-sky-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
          {loading ? "Speichere..." : "Journal speichern"}
        </button>
      </form>
    </section>
  );
}
