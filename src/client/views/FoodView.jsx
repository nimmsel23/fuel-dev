import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Pencil, Play, Trash2, Sparkles, UtensilsCrossed } from "lucide-react";
import FoodSearch from "../components/FoodSearch.jsx";
import { fetchJson, postJson } from "../lib/api.js";

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

const EMPTY_FORM = { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "" };

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function FoodView({ activeDate, setActiveDate, nutrition }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeType, setRecipeType] = useState("lunch");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeComponents, setRecipeComponents] = useState([]);
  const [catalogAddonSelection, setCatalogAddonSelection] = useState({});
  const [moveDate, setMoveDate] = useState("");
  
  const isEditing = Boolean(form.id);
  const isClientBuild = import.meta.env.VITE_APP_MODE === "client";

  // Use passed-in nutrition data (from main app) for logs
  const meals = nutrition?.meals || [];

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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAiLog = async (e) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      await postJson("/nutrition/ai-log", { text: aiText, date: activeDate });
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setAiText("");
    } catch (err) {
      console.error("AI Logging error:", err);
      alert("Fehler bei der Verarbeitung.");
    } finally {
      setAiLoading(false);
    }
  };

  function loadForEdit(meal) {
    setForm({ id: meal.id, type: meal.type, description: meal.description,
      notes: meal.notes || "", kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs, fat: meal.fat });
    setMoveDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setForm(EMPTY_FORM); setMoveDate(""); }

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

  function loadForCatalog(item) {
    setForm({
      id: null,
      type: item.meal_type || item.type || "breakfast",
      description: item.description || item.name || "",
      notes: item.notes || "",
      kcal: item.kcal ?? "",
      protein: item.protein ?? "",
      carbs: item.carbs ?? "",
      fat: item.fat ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function labelForCategory(item) {
    return CATEGORY_LABELS[item.category || item.kind || "meal"] || String(item.category || item.kind || "meal");
  }

  function buildCatalogItem(source = form) {
    const componentsSource = Array.isArray(source.components)
      ? source.components
      : Array.isArray(source.catalog_components)
        ? source.catalog_components
        : [];
    const components = componentsSource.map((component, index) => ({
          id: component.id || `${Date.now().toString(36)}_${index}`,
          label: String(component.label || component.name || component.description || "").trim(),
          description: String(component.description || component.name || "").trim(),
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
      name: String(source.name || source.description || "").trim(),
      description: String(source.description || source.name || "").trim(),
      meal_type: source.type || source.meal_type || "breakfast",
      notes: source.notes || "",
      kcal: source.kcal ?? 0,
      protein: source.protein ?? 0,
      carbs: source.carbs ?? 0,
      fat: source.fat ?? 0,
      yield_g: source.yield_g ?? null,
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

  const save = useMutation({
    mutationFn: () => {
      if (isEditing) {
        const body = { date: activeDate, meal_id: form.id,
          meal: { type: form.type, description: form.description, notes: form.notes,
            kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat } };
        if (moveDate && moveDate !== activeDate) body.new_date = moveDate;
        return fetch("/nutrition/log", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
      }
      return postJson("/nutrition/log", { date: activeDate, meal: form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
      if (moveDate) qc.invalidateQueries({ queryKey: ["nutrition", moveDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      setForm(EMPTY_FORM);
      setMoveDate("");
    },
  });

  const saveCatalog = useMutation({
    mutationFn: (source = form) => postJson("/nutrition/catalog", { item: buildCatalogItem(source) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
    },
  });

  const saveRecipeCatalog = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", {
        item: buildCatalogItem({
          name: recipeName.trim(),
          description: recipeName.trim(),
          type: recipeType,
          meal_type: recipeType,
          notes: recipeNotes,
          kcal: recipeTotals.kcal,
          protein: recipeTotals.protein,
          carbs: recipeTotals.carbs,
          fat: recipeTotals.fat,
          components: recipeComponents,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      clearRecipe();
    },
  });

  const logCatalogItem = useMutation({
    mutationFn: ({ catalogItemId, addonIds = [] }) => postJson("/nutrition/log", {
        date: activeDate,
        catalog_item_id: catalogItemId,
        catalog_addon_ids: addonIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    },
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => postJson("/nutrition/log", { date: activeDate, delete_meal_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      if (isEditing) setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="grid gap-6">
      {/* AI Dispatcher (Cloud & Local) */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300" />
            AI Logger
        </h2>
        <form onSubmit={handleAiLog}>
            <textarea 
                className={inputCls + " min-h-32"}
                placeholder="z.B. '200g Skyr mit Beeren' oder 'Füge Döner zum Katalog hinzu...'"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
            />
            <button disabled={aiLoading || !aiText.trim()} className="mt-4 bg-sky-300 text-slate-950 rounded-full px-5 py-3 font-medium disabled:opacity-60">
                {aiLoading ? "Verarbeite..." : "Loggen / Katalogisieren"}
            </button>
        </form>
      </section>

      {/* COACH-ONLY: Manual Entry & Catalog Browser */}
      {!isClientBuild && (
        <>
          {/* Nur FoodSearch zeigen wenn kein Edit-Modus */}
          {!isEditing && (
            <FoodSearch
              onSelect={({ description, kcal, protein, carbs, fat }) =>
                setForm((f) => ({ ...f, description, kcal, protein, carbs, fat }))
              }
            />
          )}

          {/* Formular */}
          <div className={twMerge(
            "rounded-2xl border p-5 space-y-4",
            isEditing ? "border-orange-400/40 bg-orange-400/5" : "border-white/10 bg-slate-950/50"
          )}>
            {isEditing && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-widest text-orange-400 shrink-0">Eintrag bearbeiten</span>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-slate-500 shrink-0">Verschieben nach</span>
                  <input type="date" className="rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-300"
                    value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
                </div>
                <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-300 shrink-0">Abbrechen</button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Datum">
                <input type="date" className={inputCls} value={activeDate}
                  onChange={(e) => setActiveDate(e.target.value)} />
              </Field>
              <Field label="Mahlzeit">
                <select className={inputCls} value={form.type} onChange={set("type")}>
                  {MEAL_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Beschreibung">
              <input className={inputCls} placeholder="Mahlzeit…" value={form.description} onChange={set("description")} />
            </Field>

            <div className="grid grid-cols-4 gap-3">
              {[["kcal","kcal"],["protein","Protein g"],["carbs","Carbs g"],["fat","Fett g"]].map(([k, lbl]) => (
                <Field key={k} label={lbl}>
                  <input type="number" min="0" className={inputCls} value={form[k]} onChange={set(k)} />
                </Field>
              ))}
            </div>

            <Field label="Notizen">
              <input className={inputCls} placeholder="optional" value={form.notes} onChange={set("notes")} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={() => save.mutate()} disabled={save.isPending || !form.description}
                className={twMerge("w-full rounded-2xl py-3 font-semibold transition",
                  save.isPending || !form.description
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-orange-400 text-slate-950 hover:bg-orange-300"
                )}>
                {save.isPending ? "Speichert…" : isEditing ? "Änderungen speichern" : `Manuell Loggen → ${activeDate}`}
              </button>
              <button
                onClick={() => saveCatalog.mutate()}
                disabled={saveCatalog.isPending || !form.description}
                className={twMerge(
                  "w-full rounded-2xl border py-3 font-semibold transition",
                  saveCatalog.isPending || !form.description
                    ? "border-white/10 bg-slate-900/50 text-slate-500 cursor-not-allowed"
                    : "border-orange-400/30 bg-orange-400/10 text-orange-200 hover:bg-orange-400/15",
                )}
              >
                <BookmarkPlus className="mr-2 inline h-4 w-4" />
                {saveCatalog.isPending ? "Speichert…" : "Als Gericht speichern"}
              </button>
            </div>
          </div>

          {/* Recipe Builder */}
          <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-300">
                  <ChefHat className="h-3.5 w-3.5" />
                  Gericht bauen
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Einzelteile suchen, zusammensetzen und als Menü oder Rezept speichern.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
                {recipeComponents.length} Komponenten
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Gericht-Name">
                <input
                  className={inputCls}
                  placeholder="z.B. McDonald's Double Cheeseburger Menu"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                />
              </Field>
              <Field label="Mahlzeit-Typ">
                <select className={inputCls} value={recipeType} onChange={(e) => setRecipeType(e.target.value)}>
                  {MEAL_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>
            
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 mt-3">
              <FoodSearch onSelect={addRecipeComponent} />
            </div>

            {recipeComponents.length > 0 && (
              <div className="mt-4 grid gap-2">
                {recipeComponents.map((component) => (
                  <div key={component.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">{component.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {component.grams != null ? `${component.grams} g · ` : ""}
                          {Math.round(component.kcal)} kcal · P {Math.round(component.protein * 10) / 10}g · C {Math.round(component.carbs * 10) / 10}g · F {Math.round(component.fat * 10) / 10}g
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecipeComponents((items) => items.filter((item) => item.id !== component.id))}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-red-300 transition"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <span>Summe: <strong className="text-sky-200">{Math.round(recipeTotals.kcal)} kcal</strong></span>
              <button
                type="button"
                onClick={() => saveRecipeCatalog.mutate()}
                disabled={saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0}
                className="ml-auto bg-sky-300 text-slate-950 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                Als Rezept speichern
              </button>
            </div>
          </div>

          {/* Gerichte-Katalog */}
          <div className="rounded-2xl border border-orange-400/15 bg-orange-400/5 p-5">
            <h3 className="mb-4 text-xs uppercase tracking-[0.2em] text-orange-300 flex items-center gap-2">
                <ChefHat className="h-4 w-4" />
                Gerichte-Katalog
            </h3>
            <div className="grid gap-5">
                {Object.entries(catalogGroups).map(([groupKey, items]) => (
                <section key={groupKey} className="grid gap-3">
                    <h4 className="text-[10px] uppercase tracking-[0.18em] text-slate-500 border-b border-white/5 pb-1">
                        {CATEGORY_LABELS[groupKey] || groupKey} ({items.length})
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-100 text-sm">{item.name}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                {item.kcal} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                            </div>
                            </div>
                            <button
                                onClick={() => logCatalogItem.mutate({
                                    catalogItemId: item.id,
                                    addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || [],
                                })}
                                className="bg-orange-400/10 text-orange-300 border border-orange-400/20 rounded-full p-2 hover:bg-orange-400/20 transition"
                            >
                                <Play className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        </div>
                    ))}
                    </div>
                </section>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Heutige Logs (Cloud & Local) */}
      <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-orange-300" />
          Heute gegessen
        </h3>
        <div className="grid gap-3">
          {meals.length ? meals.slice().reverse().map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 px-4 py-3 hover:bg-slate-900/70 transition">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-100">{m.description}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {MEAL_LABEL[m.type] || m.type}
                  {" · "}<span className="text-orange-300">{m.kcal} kcal</span>
                  {" · "}P {m.protein}g · C {m.carbs}g · F {m.fat}g
                </div>
              </div>
              {!isClientBuild && (
                  <div className="ml-3 flex gap-2 shrink-0">
                    <button onClick={() => loadForEdit(m)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-orange-400">
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMeal.mutate(m.id)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
              )}
            </div>
          )) : <p className="text-sm text-slate-400">Keine Einträge heute.</p>}
        </div>
      </section>
    </div>
  );
}
