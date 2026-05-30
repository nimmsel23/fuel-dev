import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Sparkles, Trash2 } from "lucide-react";
import { fetchJson, postJson } from "../lib/api.js";
import FoodSearch from "../components/FoodSearch.jsx";
import { Field, Input } from "../components/ui.jsx";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function FoodView() {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [recipeType, setRecipeType] = useState("lunch");
  const [aiLoading, setAiLoading] = useState(false);
  const [recipeComponents, setRecipeComponents] = useState([]);

  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    staleTime: 60_000,
  });
  const catalog = catalogData?.items || [];

  const estimateMacros = useMutation({
    mutationFn: (text) => postJson("/nutrition/ai-log", { text }), // Using the existing route which already triggers gemini
    onSuccess: (data) => {
        if (data.type === "meal") {
            const { description, kcal, protein, carbs, fat } = data.meal;
            setRecipeName(description);
            addRecipeComponent({ description, kcal, protein, carbs, fat });
        }
        setAiLoading(false);
    },
    onError: () => setAiLoading(false)
  });

  function addRecipeComponent(component) {
    setRecipeComponents((items) => [
      ...items,
      {
        id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        label: component.description,
        kcal: component.kcal ?? 0,
        protein: component.protein ?? 0,
        carbs: component.carbs ?? 0,
        fat: component.fat ?? 0,
      },
    ]);
  }

  const saveRecipeCatalog = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", { 
        item: {
            name: recipeName,
            meal_type: recipeType,
            kcal: recipeComponents.reduce((s, c) => s + c.kcal, 0),
            protein: recipeComponents.reduce((s, c) => s + c.protein, 0),
            carbs: recipeComponents.reduce((s, c) => s + c.carbs, 0),
            fat: recipeComponents.reduce((s, c) => s + c.fat, 0),
            components: recipeComponents
        } 
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setRecipeName("");
      setRecipeComponents([]);
    },
  });

  return (
    <div>
      <div className="mb-6 border-b border-white/10 pb-8">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2 mb-4">
          <ChefHat className="h-6 w-6 text-sky-400" />
          Katalog-Enrichment (Gemini)
        </h2>
        
        <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
           <Field label="AI-Gericht-Beschreibung">
              <textarea 
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100"
                placeholder="z.B. 'Ein großer Döner mit alles'"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
           </Field>
           <button 
             onClick={() => { setAiLoading(true); estimateMacros.mutate(description); }} 
             disabled={aiLoading || !description.trim()}
             className="mt-3 bg-violet-400 text-slate-950 rounded-2xl px-4 py-3 flex items-center gap-2"
           >
             <Sparkles className="h-4 w-4" />
             {aiLoading ? "Gemini schätzt..." : "Analysieren & Bauen"}
           </button>

           <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-lg font-semibold mb-3">Aktuelles Rezept: {recipeName}</h3>
              {recipeComponents.map(c => (
                  <div key={c.id} className="flex justify-between py-2 text-sm text-slate-300">
                      <span>{c.label} ({c.kcal} kcal)</span>
                      <button onClick={() => setRecipeComponents(prev => prev.filter(x => x.id !== c.id))} className="text-red-400"><Trash2 className="h-4 w-4"/></button>
                  </div>
              ))}
              <button 
                onClick={() => saveRecipeCatalog.mutate()} 
                disabled={saveRecipeCatalog.isPending || !recipeName}
                className="mt-4 bg-sky-300 text-slate-950 rounded-2xl px-4 py-3"
              >
                {saveRecipeCatalog.isPending ? "Speichert..." : "In Katalog speichern"}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
