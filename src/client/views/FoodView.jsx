import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Pencil, Play, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { fetchJson, postJson, patchJson } from "../lib/api.js";
import FoodSearch from "../components/FoodSearch.jsx";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map(({ value, label }) => [value, label]));
const CATEGORY_LABELS = {
  jause: "Jause", restaurant: "Restaurant", billa: "BILLA",
  meal: "Gericht", breakfast: "Frühstück", lunch: "Mittagessen",
  dinner: "Abendessen", snack: "Snack", recipe: "Rezept",
};

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const EMPTY_FORM = { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "" };

const isCloud = () => {
  const host = window.location.hostname;
  return host.includes("web.app") || host.includes("firebaseapp.com");
};

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
  const cloud = isCloud();

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
    (acc, c) => ({
      kcal:    acc.kcal    + (Number(c.kcal)    || 0),
      protein: acc.protein + (Number(c.protein) || 0),
      carbs:   acc.carbs   + (Number(c.carbs)   || 0),
      fat:     acc.fat     + (Number(c.fat)      || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cancelEdit = () => { setForm(EMPTY_FORM); setMoveDate(""); };
  const clearRecipe = () => { setRecipeName(""); setRecipeType("lunch"); setRecipeNotes(""); setRecipeComponents([]); };

  function loadForEdit(meal) {
    setForm({ id: meal.id, type: meal.type, description: meal.description,
      notes: meal.notes || "", kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs, fat: meal.fat });
    setMoveDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function loadForCatalog(item) {
    setForm({
      id: null, type: item.meal_type || item.type || "breakfast",
      description: item.description || item.name || "",
      notes: item.notes || "", kcal: item.kcal ?? "", protein: item.protein ?? "",
      carbs: item.carbs ?? "", fat: item.fat ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCatalogAddon(itemId, addonId) {
    setCatalogAddonSelection((cur) => {
      const ids = new Set(cur[itemId] || []);
      if (ids.has(addonId)) ids.delete(addonId); else ids.add(addonId);
      return { ...cur, [itemId]: Array.from(ids) };
    });
  }

  function setCatalogDefaultAddons(item) {
    const defaults = Array.isArray(item.default_addon_ids) ? item.default_addon_ids : [];
    setCatalogAddonSelection((cur) => ({ ...cur, [item.id]: defaults }));
  }

  function buildCatalogItem(source = form) {
    const componentsSource = Array.isArray(source.components) ? source.components
      : Array.isArray(source.catalog_components) ? source.catalog_components : [];
    const components = componentsSource.map((c, i) => ({
      id: c.id || `${Date.now().toString(36)}_${i}`,
      label: String(c.label || c.name || c.description || "").trim(),
      description: String(c.description || c.name || "").trim(),
      brand: c.brand || "", grams: c.grams == null ? null : Number(c.grams),
      kcal: Number(c.kcal) || 0, protein: Number(c.protein) || 0,
      carbs: Number(c.carbs) || 0, fat: Number(c.fat) || 0,
      source: c.source || "manual", source_kind: c.source_kind || "food",
    }));
    return {
      kind: components.length > 1 ? "recipe" : "meal",
      category: components.length > 1 ? "recipe" : "meal",
      name: String(source.name || source.description || "").trim(),
      description: String(source.description || source.name || "").trim(),
      meal_type: source.type || source.meal_type || "breakfast",
      notes: source.notes || "",
      kcal: source.kcal ?? 0, protein: source.protein ?? 0,
      carbs: source.carbs ?? 0, fat: source.fat ?? 0,
      yield_g: source.yield_g ?? null, components, source: "manual",
    };
  }

  function addRecipeComponent(component) {
    setRecipeComponents((items) => [...items, {
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      label: component.description || component.name,
      description: component.description || component.name,
      brand: component.brand || "", grams: component.grams ?? null,
      kcal: component.kcal ?? 0, protein: component.protein ?? 0,
      carbs: component.carbs ?? 0, fat: component.fat ?? 0,
      source: component.source || "off", source_kind: "food",
    }]);
  }

  const handleAiLog = async (e) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      await postJson("/nutrition/ai-log", { text: aiText, date: activeDate });
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setAiText("");
    } catch (err) {
      console.error("AI Logging error:", err);
      alert("Fehler bei der Verarbeitung.");
    } finally {
      setAiLoading(false);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      if (isEditing) {
        const body = {
          date: activeDate, meal_id: form.id,
          meal: { type: form.type, description: form.description, notes: form.notes,
            kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat },
        };
        if (moveDate && moveDate !== activeDate) body.new_date = moveDate;
        return patchJson("/nutrition/log", body);
      }
      return postJson("/nutrition/log", {
        date: activeDate,
        meal: { type: form.type, description: form.description, notes: form.notes,
          kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      if (moveDate) qc.invalidateQueries({ queryKey: ["nutrition", moveDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      setForm(EMPTY_FORM);
      setMoveDate("");
    },
  });

  const saveCatalog = useMutation({
    mutationFn: (source = form) => postJson("/nutrition/catalog", { item: buildCatalogItem(source) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] }),
  });

  const saveRecipeCatalog = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", {
      item: buildCatalogItem({
        name: recipeName.trim(), description: recipeName.trim(),
        type: recipeType, meal_type: recipeType, notes: recipeNotes,
        kcal: recipeTotals.kcal, protein: recipeTotals.protein,
        carbs: recipeTotals.carbs, fat: recipeTotals.fat, components: recipeComponents,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nutrition-catalog"] }); clearRecipe(); },
  });

  const logCatalogItem = useMutation({
    mutationFn: ({ catalogItemId, addonIds = [] }) => postJson("/nutrition/log", {
      date: activeDate, catalog_item_id: catalogItemId, catalog_addon_ids: addonIds,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    },
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => postJson("/nutrition/log", { date: activeDate, delete_meal_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      if (isEditing) setForm(EMPTY_FORM);
    },
  });

  return (
    <div>
      {/* AI Logger — nur lokal (kein Cloud-Backend) */}
      {!cloud && (
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300" />
            AI Logger
          </h2>
          <form onSubmit={handleAiLog}>
            <textarea
              className={inputCls + " min-h-32 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all"}
              placeholder="Was hast du gegessen? z.B. '200g Skyr mit Beeren'"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
            />
            <button
              disabled={aiLoading || !aiText.trim()}
              className="mt-4 w-full bg-sky-300 text-slate-950 rounded-full py-4 font-bold disabled:opacity-50 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]"
            >
              {aiLoading ? "Verarbeite..." : "Eintrag loggen"}
            </button>
          </form>
        </section>
      )}

      {/* Food Search */}
      {!isEditing && (
        <FoodSearch
          onSelect={({ description, kcal, protein, carbs, fat }) =>
            setForm((f) => ({ ...f, description, kcal, protein, carbs, fat }))
          }
        />
      )}

      {/* Manuelles Log-Formular */}
      <div id="edit-form" className={twMerge(
        "rounded-2xl border p-5 space-y-4 mb-6 transition-all duration-300",
        isEditing ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.2)] bg-orange-400/5 ring-1 ring-orange-400/20" : "border-white/10 bg-slate-950/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing ? <Pencil className="h-4 w-4 text-orange-400" /> : <UtensilsCrossed className="h-4 w-4 text-slate-400" />}
            <h3 className={twMerge("text-sm font-semibold uppercase tracking-widest", isEditing ? "text-orange-400" : "text-slate-400")}>
              {isEditing ? "Eintrag bearbeiten" : "Mahlzeit loggen"}
            </h3>
          </div>
          {isEditing && (
            <button onClick={cancelEdit} className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors bg-white/5 px-2 py-1 rounded-md">
              Abbrechen
            </button>
          )}
        </div>
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
          {[["kcal", "kcal"], ["protein", "Protein g"], ["carbs", "Carbs g"], ["fat", "Fett g"]].map(([k, lbl]) => (
            <Field key={k} label={lbl}>
              <input type="number" min="0" className={inputCls} value={form[k]} onChange={set(k)} />
            </Field>
          ))}
        </div>
        <Field label="Notizen">
          <input className={inputCls} placeholder="optional" value={form.notes} onChange={set("notes")} />
        </Field>
        {isEditing && (
          <Field label="Verschieben auf Datum">
            <input type="date" className={inputCls} value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => save.mutate()} disabled={save.isPending || !form.description}
            className={twMerge("w-full rounded-2xl py-3 font-semibold transition",
              save.isPending || !form.description
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-orange-400 text-slate-950 hover:bg-orange-300"
            )}>
            {save.isPending ? "Speichert…" : isEditing ? "Änderungen speichern" : `Loggen → ${activeDate}`}
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
        {saveCatalog.isError && <p className="text-sm text-red-300">{saveCatalog.error.message}</p>}
        {saveCatalog.isSuccess && <p className="text-sm text-emerald-300">Gericht im Katalog gespeichert.</p>}
      </div>

      {/* Gericht bauen (Rezept-Builder) */}
      <div className="mb-6 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-300">
              <ChefHat className="h-3.5 w-3.5" />
              Gericht bauen
            </div>
            <p className="mt-1 text-sm text-slate-400">Einzelteile suchen, zusammensetzen und als Menü oder Rezept speichern.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
            {recipeComponents.length} Komponenten
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gericht-Name">
            <input className={inputCls} placeholder="z.B. McDonald's Double Cheeseburger Menu"
              value={recipeName} onChange={(e) => setRecipeName(e.target.value)} />
          </Field>
          <Field label="Mahlzeit-Typ">
            <select className={inputCls} value={recipeType} onChange={(e) => setRecipeType(e.target.value)}>
              {MEAL_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notizen">
          <input className={inputCls} placeholder="optional, z.B. Menügröße oder Variante"
            value={recipeNotes} onChange={(e) => setRecipeNotes(e.target.value)} />
        </Field>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-100">Komponenten hinzufügen</strong>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Suche + Portion wählen</span>
          </div>
          <FoodSearch onSelect={addRecipeComponent} />
        </div>
        {recipeComponents.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {recipeComponents.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">{c.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {c.grams != null ? `${c.grams} g · ` : ""}
                      {Math.round(c.kcal)} kcal · P {Math.round(c.protein * 10) / 10}g · C {Math.round(c.carbs * 10) / 10}g · F {Math.round(c.fat * 10) / 10}g
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => setRecipeComponents((items) => items.filter((item) => item.id !== c.id))}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-red-300 transition">
                    Entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            Noch keine Komponenten. Suche nacheinander Burger, Pommes, Cola, Beilage etc. und füge sie hinzu.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span>Summe: <strong className="text-sky-200">{Math.round(recipeTotals.kcal)} kcal</strong></span>
          <span>P {Math.round(recipeTotals.protein * 10) / 10}g</span>
          <span>C {Math.round(recipeTotals.carbs * 10) / 10}g</span>
          <span>F {Math.round(recipeTotals.fat * 10) / 10}g</span>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => saveRecipeCatalog.mutate()}
            disabled={saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0}
            className={twMerge("rounded-2xl px-4 py-3 font-semibold transition",
              saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-sky-300 text-slate-950 hover:bg-sky-200",
            )}>
            {saveRecipeCatalog.isPending ? "Speichert…" : "Gericht als Rezept speichern"}
          </button>
          <button type="button" onClick={clearRecipe}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 transition">
            Leeren
          </button>
        </div>
        {saveRecipeCatalog.isError && <p className="mt-3 text-sm text-red-300">{saveRecipeCatalog.error.message}</p>}
        {saveRecipeCatalog.isSuccess && <p className="mt-3 text-sm text-emerald-300">Rezept im Katalog gespeichert.</p>}
      </div>

      {/* Gerichte-Katalog */}
      <div className="mb-6 rounded-2xl border border-orange-400/15 bg-orange-400/5 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-orange-300">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Gerichte-Katalog
            </div>
            <p className="mt-1 text-sm text-slate-400">Wiederkehrende Mahlzeiten speichern und später direkt loggen.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
            {catalog.length} Einträge
          </span>
        </div>
        {catalog.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            Noch keine Gerichte gespeichert. Logge eine Mahlzeit und speichere sie dann als Katalogeintrag.
          </p>
        ) : (
          <div className="grid gap-5">
            {Object.entries(catalogGroups).map(([groupKey, items]) => (
              <section key={groupKey} className="grid gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm uppercase tracking-[0.18em] text-slate-400">
                    {CATEGORY_LABELS[groupKey] || groupKey}
                  </h4>
                  <span className="text-xs text-slate-500">{items.length} Einträge</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-100">{item.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {MEAL_LABEL[item.meal_type] || item.meal_type || item.kind || "meal"}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">
                          {CATEGORY_LABELS[item.category || item.kind || "meal"] || item.category || item.kind}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-slate-400">
                        {item.kcal} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                      </div>
                      {item.notes ? <div className="mt-2 text-xs text-slate-500">{item.notes}</div> : null}
                      {Array.isArray(item.addons) && item.addons.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Add-ons</div>
                          <div className="flex flex-wrap gap-2">
                            {item.addons.map((addon) => {
                              const selectedIds = catalogAddonSelection[item.id] || item.default_addon_ids || [];
                              const active = selectedIds.includes(addon.id);
                              return (
                                <button key={addon.id} type="button"
                                  onClick={() => toggleCatalogAddon(item.id, addon.id)}
                                  className={twMerge(
                                    "rounded-full border px-3 py-1 text-xs transition",
                                    active
                                      ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
                                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                                  )}>
                                  {addon.label}
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" onClick={() => setCatalogDefaultAddons(item)}
                            className="w-fit text-xs text-slate-500 hover:text-slate-300">
                            Defaults setzen
                          </button>
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => loadForCatalog(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition">
                          <Pencil className="h-3.5 w-3.5" />
                          Übernehmen
                        </button>
                        <button type="button"
                          onClick={() => logCatalogItem.mutate({
                            catalogItemId: item.id,
                            addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || [],
                          })}
                          disabled={logCatalogItem.isPending}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-sm text-orange-200 hover:bg-orange-400/15 transition disabled:cursor-not-allowed disabled:opacity-60">
                          <Play className="h-3.5 w-3.5" />
                          Loggen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {logCatalogItem.isError && <p className="mt-3 text-sm text-red-300">{logCatalogItem.error.message}</p>}
      </div>

      {/* Geloggte Mahlzeiten */}
      {meals.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
          <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            Einträge · {activeDate}
          </h3>
          <div className="space-y-2">
            {meals.map((m) => (
              <div key={m.id}
                className={twMerge(
                  "flex items-center justify-between rounded-xl border px-4 py-3 transition",
                  form.id === m.id
                    ? "border-orange-400/40 bg-orange-400/5"
                    : "border-white/5 bg-slate-900/40 hover:bg-slate-900/70"
                )}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-100">{m.description}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {MEAL_LABEL[m.type] || m.type}
                    {" · "}<span className="text-orange-300">{m.kcal} kcal</span>
                    {" · "}P {m.protein}g · C {m.carbs}g · F {m.fat}g
                  </div>
                </div>
                <div className="ml-3 flex gap-2 shrink-0">
                  <button type="button" onClick={() => saveCatalog.mutate(m)}
                    disabled={saveCatalog.isPending || !m.description}
                    title="Als Gericht speichern"
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 transition disabled:cursor-not-allowed disabled:opacity-50">
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => loadForEdit(m)}
                    title="Eintrag bearbeiten"
                    className={twMerge(
                      "rounded-lg border p-2 transition",
                      form.id === m.id 
                        ? "border-orange-400 bg-orange-400 text-slate-950" 
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10"
                    )}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteMeal.mutate(m.id)}
                    title="Löschen"
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500 flex gap-4">
            <span>Total: <span className="text-orange-300 font-semibold">{meals.reduce((s, m) => s + (m.kcal || 0), 0)} kcal</span></span>
            <span>P {meals.reduce((s, m) => s + (m.protein || 0), 0).toFixed(1)}g</span>
            <span>C {meals.reduce((s, m) => s + (m.carbs || 0), 0).toFixed(1)}g</span>
            <span>F {meals.reduce((s, m) => s + (m.fat || 0), 0).toFixed(1)}g</span>
          </div>
        </div>
      )}
    </div>
  );
}
