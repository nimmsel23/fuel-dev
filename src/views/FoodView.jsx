import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { BookmarkPlus, ChefHat, Pencil, Play, Trash2 } from "lucide-react";
import FoodSearch from "../components/FoodSearch.jsx";

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

export default function FoodView({ activeDate, setActiveDate }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [recipeName, setRecipeName] = useState("");
  const [recipeType, setRecipeType] = useState("lunch");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeComponents, setRecipeComponents] = useState([]);
  const [catalogAddonSelection, setCatalogAddonSelection] = useState({});
  const [moveDate, setMoveDate] = useState("");
  const isEditing = Boolean(form.id);

  const { data: dayData } = useQuery({
    queryKey: ["nutrition", activeDate],
    queryFn: () => fetch(`/nutrition/log?date=${activeDate}`).then((r) => r.json()).then((d) => d.data),
    staleTime: 30_000,
  });
  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetch("/nutrition/catalog").then((r) => r.json()),
    staleTime: 60_000,
  });
  const meals = dayData?.meals || [];
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
      return fetch("/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: activeDate, meal: form }),
      }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
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
    mutationFn: (source = form) => fetch("/nutrition/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: buildCatalogItem(source) }),
    }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
    },
  });

  const saveRecipeCatalog = useMutation({
    mutationFn: () => fetch("/nutrition/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      clearRecipe();
    },
  });

  const logCatalogItem = useMutation({
    mutationFn: ({ catalogItemId, addonIds = [] }) => fetch("/nutrition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: activeDate,
        catalog_item_id: catalogItemId,
        catalog_addon_ids: addonIds,
      }),
    }).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    },
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => fetch("/nutrition/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: activeDate, delete_meal_id: id }),
    }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      if (isEditing) setForm(EMPTY_FORM);
    },
  });

  return (
    <div>
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
        "rounded-2xl border p-5 space-y-4 mb-6",
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
        {saveCatalog.isError ? <p className="text-sm text-red-300">{saveCatalog.error.message}</p> : null}
        {saveCatalog.isSuccess ? <p className="text-sm text-emerald-300">Gericht im Katalog gespeichert.</p> : null}
      </div>

      <div className="mb-6 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
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
        <Field label="Notizen">
          <input
            className={inputCls}
            placeholder="optional, z.B. Menügröße oder Variante"
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
          />
        </Field>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-100">Komponenten hinzufügen</strong>
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Suche + Portion wählen
            </span>
          </div>
          <FoodSearch onSelect={addRecipeComponent} />
        </div>

        {recipeComponents.length > 0 ? (
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
          <button
            type="button"
            onClick={() => saveRecipeCatalog.mutate()}
            disabled={saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0}
            className={twMerge(
              "rounded-2xl px-4 py-3 font-semibold transition",
              saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-sky-300 text-slate-950 hover:bg-sky-200",
            )}
          >
            {saveRecipeCatalog.isPending ? "Speichert…" : "Gericht als Rezept speichern"}
          </button>
          <button
            type="button"
            onClick={clearRecipe}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 transition"
          >
            Leeren
          </button>
        </div>
        {saveRecipeCatalog.isError ? <p className="mt-3 text-sm text-red-300">{saveRecipeCatalog.error.message}</p> : null}
        {saveRecipeCatalog.isSuccess ? <p className="mt-3 text-sm text-emerald-300">Rezept im Katalog gespeichert.</p> : null}
      </div>

      <div className="mb-6 rounded-2xl border border-orange-400/15 bg-orange-400/5 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-orange-300">
              <ChefHat className="h-3.5 w-3.5" />
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
                        <span className="text-xs text-slate-500">{labelForCategory(item)}</span>
                      </div>
                      <div className="mt-3 text-sm text-slate-400">
                        {item.kcal} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                      </div>
                      {item.notes ? <div className="mt-2 text-xs text-slate-500">{item.notes}</div> : null}
                      {Array.isArray(item.addons) && item.addons.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Add-ons</div>
                          <div className="flex flex-wrap gap-2">
                            {item.addons.map((addon) => {
                              const selectedIds = catalogAddonSelection[item.id] || item.default_addon_ids || [];
                              const active = selectedIds.includes(addon.id);
                              return (
                                <button
                                  key={addon.id}
                                  type="button"
                                  onClick={() => toggleCatalogAddon(item.id, addon.id)}
                                  className={twMerge(
                                    "rounded-full border px-3 py-1 text-xs transition",
                                    active
                                      ? "border-sky-300/40 bg-sky-300/15 text-sky-100"
                                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                                  )}
                                >
                                  {addon.label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCatalogDefaultAddons(item)}
                            className="w-fit text-xs text-slate-500 hover:text-slate-300"
                          >
                            Defaults setzen
                          </button>
                        </div>
                      ) : null}
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => loadForCatalog(item)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Übernehmen
                        </button>
                        <button
                          type="button"
                          onClick={() => logCatalogItem.mutate({
                            catalogItemId: item.id,
                            addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || [],
                          })}
                          disabled={logCatalogItem.isPending}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-sm text-orange-200 hover:bg-orange-400/15 transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
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
        {logCatalogItem.isError ? <p className="mt-3 text-sm text-red-300">{logCatalogItem.error.message}</p> : null}
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
                  <button
                    type="button"
                    onClick={() => saveCatalog.mutate(m)}
                    disabled={saveCatalog.isPending || !m.description}
                    title="Als Gericht speichern"
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-orange-400 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => loadForEdit(m)}
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-orange-400 transition">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteMeal.mutate(m.id)}
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400 transition">
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
