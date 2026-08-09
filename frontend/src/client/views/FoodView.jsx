import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { Play, Sparkles, UtensilsCrossed } from "lucide-react";
import { postJson } from "@api";
import { Empty } from "../components/ui.jsx";
import { formatMetric } from "../../shared/utils/utils.js";
import FoodSearch from "../components/FoodSearch.jsx";

export default function FoodView({ activeDate, mealCatalog = [] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const invalidateAfterLog = () => {
    qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
    qc.invalidateQueries({ queryKey: ["week-logs"] });
  };

  const logFood = useMutation({
    mutationFn: (text) => postJson("/nutrition/log", { date: activeDate, text }),
    onSuccess: () => {
      invalidateAfterLog();
      setText("");
    },
  });

  const logFromCatalog = useMutation({
    mutationFn: (item) => postJson("/nutrition/log", { date: activeDate, catalog_item_id: item.id }),
    onSuccess: invalidateAfterLog,
  });

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-orange-300" />
          <h3 className="text-lg font-semibold">Quick log</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {mealCatalog.length ? mealCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => logFromCatalog.mutate(item)}
              disabled={logFromCatalog.isPending}
              className="text-left rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:bg-slate-900 disabled:opacity-60"
            >
              <strong className="text-slate-100">{item.name}</strong>
              <div className="mt-2 text-sm text-slate-400">
                {formatMetric(item.kcal)} kcal · P {formatMetric(item.protein)}g · C {formatMetric(item.carbs)}g · F {formatMetric(item.fat)}g
              </div>
            </button>
          )) : <Empty text="Kein Meal-Katalog geladen." />}
        </div>
        {logFromCatalog.isError ? <p className="mt-3 text-sm text-rose-300">{logFromCatalog.error.message}</p> : null}
      </div>

      <div className="rounded-3xl border border-sky-400/15 bg-sky-400/5 p-6 shadow-glow">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-300">
              <Sparkles className="h-4 w-4" />
              NLP Logging
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">Was hast du gegessen?</h2>
          </div>
        </div>
        
        <div className="space-y-4">
          <FoodSearch
            onSelect={(food) => {
              const desc = `${food.grams}g ${food.description}`;
              setText((prev) => (prev ? `${prev}, ${desc}` : desc));
            }}
          />
          <label className="grid gap-2 text-sm text-slate-300">
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 min-h-[120px] resize-none focus:ring-2 focus:ring-sky-400/50 outline-none transition-all" 
              placeholder="z.B. Ich habe 200g Lachs mit 150g Reis und Brokkoli gegessen..."
              value={text} 
              onChange={(e) => setText(e.target.value)} 
            />
          </label>

          <button type="button" onClick={() => logFood.mutate(text)}
            disabled={logFood.isPending || !text.trim()}
            className={twMerge("w-full flex justify-center items-center gap-2 rounded-2xl py-4 font-bold transition shadow-lg",
              logFood.isPending || !text.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-sky-300 text-slate-950 hover:bg-sky-200 active:scale-[0.98]",
            )}>
            {logFood.isPending ? (
              "Analysiere & Speichere..."
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" />
                Mahlzeit loggen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
