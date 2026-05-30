import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Droplets, NotebookPen, UtensilsCrossed } from "lucide-react";
import { Field, Input, MealRow, Empty, inputClassName } from "../components/ui.jsx";
import { postJson } from "../lib/api.js";
import { callGemini, extractJson } from "../services/gemini.mjs";
import * as firestore from "../lib/firestore-db.js";

const mealSchema = z.object({
  date: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1, "Bitte eine Mahlzeit eintragen."),
  notes: z.string().optional().default(""),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
});

export default function JournalView({ date, nutrition, journal }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const meals = nutrition?.meals || [];

  const mealForm = useForm({
    resolver: zodResolver(mealSchema),
    defaultValues: { date, type: "breakfast", description: "", notes: "", kcal: 0, protein: 0, carbs: 0, fat: 0 },
  });

  const mealMutation = useMutation({
    mutationFn: (values) => postJson("/nutrition/log", { date: values.date, meal: values }),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", values.date] });
      mealForm.reset({ date: values.date, type: "breakfast", description: "", notes: "", kcal: 0, protein: 0, carbs: 0, fat: 0 });
    },
  });

  const handleLog = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);

    try {
      const prompt = `Analysiere diesen Text. Ist es eine Mahlzeit? Wenn ja, schätze Makros (kcal, protein, carbs, fat). Wenn nein, ist es ein Tagebucheintrag. Gib JSON zurück:
      {"type": "meal" | "journal", "meal": {"description", "kcal", "protein", "carbs", "fat"}?, "content": "..."?}
      Text: ${text}`;
      
      const raw = await callGemini(prompt);
      const result = JSON.parse(extractJson(raw));

      if (result.type === "meal") {
        await postJson("/nutrition/log", { date, meal: result.meal });
        queryClient.invalidateQueries({ queryKey: ["nutrition", date] });
      } else {
        await postJson("/nutrition/journal", { date, content: result.content || text });
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
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        {/* AI Logger */}
        <form onSubmit={handleLog} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">AI Logger</h2>
              <p className="text-sm text-slate-400">Natürliche Sprache eingeben.</p>
            </div>
            <NotebookPen className="h-5 w-5 text-sky-300" />
          </div>
          <textarea 
            className="min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="z.B. 2 Eier mit 100g Haferflocken"
          />
          <button disabled={loading || !text.trim()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
            {loading ? "Verarbeite..." : "Loggen"}
          </button>
        </form>

        {/* Manual Meal Logger */}
        <form onSubmit={mealForm.handleSubmit((values) => mealMutation.mutate(values))} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <h2 className="text-xl font-semibold mb-4">Meal Logger (Manuell)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Meal type">
              <select className={inputClassName} {...mealForm.register("type")}>
                <option value="breakfast">Frühstück</option>
                <option value="lunch">Mittagessen</option>
                <option value="dinner">Abendessen</option>
                <option value="snack">Snack</option>
              </select>
            </Field>
            <Field label="Beschreibung">
              <Input {...mealForm.register("description")} />
            </Field>
            <Field label="kcal"><Input type="number" {...mealForm.register("kcal")} /></Field>
            <Field label="Protein"><Input type="number" {...mealForm.register("protein")} /></Field>
            <Field label="Carbs"><Input type="number" {...mealForm.register("carbs")} /></Field>
            <Field label="Fat"><Input type="number" {...mealForm.register("fat")} /></Field>
          </div>
          <button type="submit" className="mt-4 rounded-full bg-orange-400 px-5 py-3 font-medium text-slate-950">Save meal</button>
        </form>
      </div>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-orange-300" />
            <h3 className="text-lg font-semibold">Heute gegessen</h3>
          </div>
          <div className="grid gap-3">
            {meals.length ? meals.slice().reverse().map((meal) => <MealRow key={meal.id} meal={meal} />) : <Empty text="Keine Mahlzeiten heute." />}
          </div>
        </section>
      </div>
    </section>
  );
}
