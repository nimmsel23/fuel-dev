import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Pencil, Trash2 } from "lucide-react";
import { fetchJson, postJson } from "../lib/api.js";
import FoodSearch from "../components/FoodSearch.jsx";
import { Field, Input } from "../components/ui.jsx";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map(({ value, label }) => [value, label]));
const CATEGORY_LABELS = {
  jause: "Jause",
  restaurant: "Restaurant",
  billa: "BILLA",
  meal: "Gericht",
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function FoodView() {
  const qc = useQueryClient();
  const [recipeName, setRecipeName] = useState("");
  const [recipeType, setRecipeType] = useState("lunch");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeComponents, setRecipeComponents] = useState([]);
  const [catalogAddonSelection, setCatalogAddonSelection] = useState({});

  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    staleTime: 60_000,
  });
  const catalog = catalogData?.items || [];
  const catalogGroups = catalog.reduce((groups, item) => {
    const key = item.category || item.kind || "meal";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
  const recipeTotals = recipeComponents.reduce(
    (acc, component) => ({
      kcal: acc.kcal + (Number(component.kcal) || 0),
      protein: acc.protein + (Number(component.protein) || 0),
      carbs: acc.carbs + (Number(component.carbs) || 0),
      fat: acc.fat + (Number(component.fat) || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function clearRecipe() {
    setRecipeName("");
    setRecipeType("lunch");
    setRecipeNotes("");
    setRecipeComponents([]);
  }

  function toggleCatalogAddon(itemId, addonId) {
    setCatalogAddonSelection((current) => {
      const currentIds = new Set(current[itemId] || []);
      if (currentIds.has(addonId)) currentIds.delete(addonId);
      else currentIds.add(addonId);
      return { ...current, [itemId]: Array.from(currentIds) };
    });
  }

  function setCatalogDefaultAddons(item) {
    const defaults = Array.isArray(item.default_addon_ids) ? item.default_addon_ids : [];
    setCatalogAddonSelection((current) => ({ ...current, [item.id]: defaults }));
  }

  function labelForCategory(item) {
    return CATEGORY_LABELS[item.category || item.kind || "meal"] || String(item.category || item.kind || "meal");
  }

  function buildCatalogItem() {
    const components = recipeComponents.map((component, index) => ({
          id: component.id || `${Date.now().toString(36)}_${index}`,
          label: String(component.label || component.description || "").trim(),
          description: String(component.description || "").trim(),
          brand: component.brand || "",
          grams: component.grams == null ? null : Number(component.grams),
          kcal: Number(component.kcal) || 0,
          protein: Number(component.protein) || 0,
          carbs: Number(component.carbs) || 0,
          fat: Number(component.fat) || 0,
          source: component.source || "manual",
          source_kind: component.source_kind || "food",
        }));
    return {
      kind: components.length > 1 ? "recipe" : "meal",
      category: components.length > 1 ? "recipe" : "meal",
      name: String(recipeName || "").trim(),
      description: String(recipeName || "").trim(),
      meal_type: recipeType,
      notes: recipeNotes || "",
      kcal: recipeTotals.kcal,
      protein: recipeTotals.protein,
      carbs: recipeTotals.carbs,
      fat: recipeTotals.fat,
      components,
      source: "manual",
    };
  }

  function addRecipeComponent(component) {
    setRecipeComponents((items) => [
      ...items,
      {
        id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        label: component.description || component.name,
        description: component.description || component.name,
        brand: component.brand || "",
        grams: component.grams ?? null,
        kcal: component.kcal ?? 0,
        protein: component.protein ?? 0,
        carbs: component.carbs ?? 0,
        fat: component.fat ?? 0,
        source: component.source || "off",
        source_kind: "food",
      },
    ]);
  }

  const saveRecipeCatalog = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", { item: buildCatalogItem() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      clearRecipe();
    },
  });

  return (
    <div>
      <div className="mb-6 border-b border-white/10 pb-8">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2 mb-4">
          <ChefHat className="h-6 w-6 text-sky-400" />
          Gericht bauen
        </h2>
        
        <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
           <div className="mb-3">
              <p className="text-sm text-slate-400">Einzelteile suchen, zusammensetzen und als Menü speichern.</p>
           </div>
           
           <div className="grid gap-3 sm:grid-cols-2 mb-3">
             <Field label="Gericht-Name"><Input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} /></Field>
             <Field label="Typ">
                <select className={inputCls} value={recipeType} onChange={(e) => setRecipeType(e.target.value)}>
                    {MEAL_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
             </Field>
           </div>
           
           <FoodSearch onSelect={addRecipeComponent} />
           
           <div className="mt-4 flex gap-3">
             <button onClick={() => saveRecipeCatalog.mutate()} disabled={saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0} className="bg-sky-300 text-slate-950 rounded-2xl px-4 py-3">
                {saveRecipeCatalog.isPending ? "Speichert..." : "Speichern"}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
