import { useState } from "react";
import { Sparkles, UtensilsCrossed, Pill, NotebookPen } from "lucide-react";
import { postJson } from "@api";
import { twMerge } from "tailwind-merge";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function JournalVosView({ date }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("nutrition"); // "nutrition" | "supplements"
  
  // Nutrition State
  const [nutritionText, setNutritionText] = useState("");
  
  // Supplement State
  const [supp, setSupp] = useState({ name: "", dose: "", unit: "mg", time_of_day: "morning" });

  const nutMutation = useMutation({
    mutationFn: async () => {
      return postJson("/nutrition/log", { text: nutritionText });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      setNutritionText("");
    }
  });

  const suppMutation = useMutation({
    mutationFn: async () => {
      return postJson("/supplements/log", {
        name: supp.name,
        dose: parseFloat(supp.dose),
        unit: supp.unit,
        time_of_day: supp.time_of_day,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplements", date] });
      setSupp({ name: "", dose: "", unit: "mg", time_of_day: "morning" });
    }
  });

  const handleNutritionSubmit = (e) => {
    e.preventDefault();
    if (!nutritionText.trim()) return;
    nutMutation.mutate();
  };

  const handleSuppSubmit = (e) => {
    e.preventDefault();
    if (!supp.name.trim() || !supp.dose) return;
    suppMutation.mutate();
  };

  return (
    <section className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 rounded-3xl border border-sky-400/15 bg-sky-400/5 px-6 py-4">
        <Sparkles className="h-5 w-5 text-sky-300" />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-sky-300">VOS · Smart Log</div>
          <h2 className="text-base font-semibold text-slate-100">Schnell-Eingabe</h2>
        </div>
      </header>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode("nutrition")}
          className={twMerge(
            "flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-all",
            mode === "nutrition" ? "bg-orange-400 text-slate-950 shadow-[0_0_15px_rgba(251,146,60,0.4)]" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          )}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Ernährung (NLP)
        </button>
        <button
          onClick={() => setMode("supplements")}
          className={twMerge(
            "flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-all",
            mode === "supplements" ? "bg-indigo-400 text-slate-950 shadow-[0_0_15px_rgba(129,140,248,0.4)]" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          )}
        >
          <Pill className="h-4 w-4" />
          Supplement
        </button>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur">
        {mode === "nutrition" && (
          <form onSubmit={handleNutritionSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-lg font-semibold text-slate-200">Was hast du gegessen?</h3>
            <p className="text-sm text-slate-400">Nutze natürliche Sprache, z.B. <i>"Zum Frühstück hatte ich 200g Skyr mit 50g Blaubeeren"</i>.</p>
            
            <textarea
              className={twMerge(inputCls, "min-h-[150px] resize-none focus:ring-2 focus:ring-orange-400/50 outline-none")}
              placeholder="Schreib einfach drauf los..."
              value={nutritionText}
              onChange={(e) => setNutritionText(e.target.value)}
            />
            
            <button
              disabled={nutMutation.isPending || !nutritionText.trim()}
              className="w-full rounded-full bg-orange-400 text-slate-950 py-4 font-bold disabled:opacity-50 hover:bg-orange-300 transition-colors shadow-lg active:scale-[0.98]"
            >
              {nutMutation.isPending ? "Analysiere & Speichere..." : "Mahlzeit NLP Loggen"}
            </button>
            {nutMutation.isSuccess && <p className="text-emerald-400 text-sm text-center">✓ Erfolgreich geloggt!</p>}
          </form>
        )}

        {mode === "supplements" && (
          <form onSubmit={handleSuppSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-lg font-semibold text-slate-200">Supplement Tracken</h3>
            
            <Field label="Name">
              <input className={inputCls} placeholder="z.B. Omega 3, Magnesium..." value={supp.name} onChange={(e) => setSupp(s => ({ ...s, name: e.target.value }))} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Menge">
                <input type="number" step="any" min="0" className={inputCls} value={supp.dose} onChange={(e) => setSupp(s => ({ ...s, dose: e.target.value }))} />
              </Field>
              <Field label="Einheit">
                <select className={inputCls} value={supp.unit} onChange={(e) => setSupp(s => ({ ...s, unit: e.target.value }))}>
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="Tropfen">Tropfen</option>
                  <option value="Stück">Stück</option>
                  <option value="ml">ml</option>
                </select>
              </Field>
            </div>

            <Field label="Tageszeit">
              <select className={inputCls} value={supp.time_of_day} onChange={(e) => setSupp(s => ({ ...s, time_of_day: e.target.value }))}>
                <option value="morning">Morgens</option>
                <option value="noon">Mittags</option>
                <option value="evening">Abends</option>
                <option value="night">Nachts</option>
                <option value="post-workout">Post-Workout</option>
              </select>
            </Field>
            
            <button
              disabled={suppMutation.isPending || !supp.name.trim() || !supp.dose}
              className="mt-4 w-full rounded-full bg-indigo-400 text-slate-950 py-4 font-bold disabled:opacity-50 hover:bg-indigo-300 transition-colors shadow-lg active:scale-[0.98]"
            >
              {suppMutation.isPending ? "Speichere..." : "Supplement Loggen"}
            </button>
            {suppMutation.isSuccess && <p className="text-emerald-400 text-sm text-center">✓ Supplement geloggt!</p>}
          </form>
        )}
      </div>
    </section>
  );
}
