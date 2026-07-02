import { importShared } from './__federation_fn_import-BlZWqUMR.js';
import { j as jsxRuntimeExports } from './jsx-runtime-CsM3lTE3.js';
import { u as useQuery } from './useQuery-D1RM1yF9.js';
import { u as useQueryClient } from './QueryClientProvider-j9id1xDJ.js';
import { u as useMutation } from './useMutation-BQx-HQDh.js';
import { t as twMerge } from './bundle-mjs-BTFBU_Un.js';
import { p as postJson, d as deleteJson, f as fetchJson } from './api-BbKnJ9mL.js';
import { F as FoodSearch } from './FoodSearch-CwDjFbaA.js';

const {useState} = await importShared('react');
const {BookmarkPlus,ChefHat,Pencil,Play,Trash2,UtensilsCrossed} = await importShared('lucide-react');
const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagessen" },
  { value: "dinner", label: "Abendessen" },
  { value: "snack", label: "Snack" }
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
  recipe: "Rezept"
};
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const EMPTY_FORM = { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "" };
function Field({ label, children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-2 text-sm text-slate-300", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs uppercase tracking-[0.18em] text-slate-500", children: label }),
    children
  ] });
}
function FoodView({ activeDate, setActiveDate, nutrition }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [recipeName, setRecipeName] = useState("");
  const [recipeType, setRecipeType] = useState("lunch");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [recipeComponents, setRecipeComponents] = useState([]);
  const [catalogAddonSelection, setCatalogAddonSelection] = useState({});
  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    staleTime: 6e4
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
      kcal: acc.kcal + (Number(c.kcal) || 0),
      protein: acc.protein + (Number(c.protein) || 0),
      carbs: acc.carbs + (Number(c.carbs) || 0),
      fat: acc.fat + (Number(c.fat) || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const clearRecipe = () => {
    setRecipeName("");
    setRecipeType("lunch");
    setRecipeNotes("");
    setRecipeComponents([]);
  };
  function toggleCatalogAddon(itemId, addonId) {
    setCatalogAddonSelection((cur) => {
      const ids = new Set(cur[itemId] || []);
      if (ids.has(addonId)) ids.delete(addonId);
      else ids.add(addonId);
      return { ...cur, [itemId]: Array.from(ids) };
    });
  }
  function buildCatalogItem(source) {
    const components = (source.components || []).map((c, i) => ({
      id: c.id || `${Date.now().toString(36)}_${i}`,
      label: String(c.label || "").trim(),
      description: String(c.description || "").trim(),
      brand: c.brand || "",
      grams: c.grams == null ? null : Number(c.grams),
      kcal: Number(c.kcal) || 0,
      protein: Number(c.protein) || 0,
      carbs: Number(c.carbs) || 0,
      fat: Number(c.fat) || 0,
      source: c.source || "manual",
      source_kind: c.source_kind || "food"
    }));
    return {
      kind: components.length > 1 ? "recipe" : "meal",
      category: components.length > 1 ? "recipe" : "meal",
      name: String(source.name || "").trim(),
      description: String(source.description || "").trim(),
      meal_type: source.type || source.meal_type || "breakfast",
      notes: source.notes || "",
      kcal: source.kcal ?? 0,
      protein: source.protein ?? 0,
      carbs: source.carbs ?? 0,
      fat: source.fat ?? 0,
      yield_g: source.yield_g ?? null,
      components,
      source: "manual"
    };
  }
  function addRecipeComponent(component) {
    setRecipeComponents((items) => [...items, {
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
      source_kind: "food"
    }]);
  }
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
        components: recipeComponents
      })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      clearRecipe();
    }
  });
  const logCatalogItem = useMutation({
    mutationFn: ({ catalogItemId, addonIds = [] }) => postJson("/nutrition/log", {
      date: activeDate,
      catalog_item_id: catalogItemId,
      catalog_addon_ids: addonIds
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    }
  });
  const deleteCatalogItem = useMutation({
    mutationFn: (id) => deleteJson(`/nutrition/catalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] })
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-8", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-8 lg:grid-cols-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-3xl border border-sky-400/15 bg-sky-400/5 p-6 shadow-glow", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-300", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChefHat, { className: "h-4 w-4" }),
            "Library"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-1 text-2xl font-bold tracking-tight text-slate-100", children: "Rezept-Builder" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rounded-full border border-white/10 bg-slate-950/70 px-4 py-1.5 text-sm font-medium text-slate-400", children: [
          recipeComponents.length,
          " Teile"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Gericht-Name", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: inputCls,
              placeholder: "z.B. Haferflocken Deluxe",
              value: recipeName,
              onChange: (e) => setRecipeName(e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Mahlzeit-Typ", children: /* @__PURE__ */ jsxRuntimeExports.jsx("select", { className: inputCls, value: recipeType, onChange: (e) => setRecipeType(e.target.value), children: MEAL_TYPES.map(({ value, label }) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value, children: label }, value)) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Notizen", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: inputCls,
            placeholder: "optional, z.B. Zubereitung",
            value: recipeNotes,
            onChange: (e) => setRecipeNotes(e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-white/5 bg-slate-950/60 p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-3 flex items-center justify-between gap-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "text-sm text-slate-100 uppercase tracking-widest", children: "Komponenten" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(FoodSearch, { onSelect: addRecipeComponent })
        ] }),
        recipeComponents.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-2", children: recipeComponents.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-medium text-slate-100", children: c.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-0.5 text-xs text-slate-500", children: [
              c.grams != null ? `${c.grams} g · ` : "",
              Math.round(c.kcal),
              " kcal · P ",
              Math.round(c.protein * 10) / 10,
              "g · C ",
              Math.round(c.carbs * 10) / 10,
              "g · F ",
              Math.round(c.fat * 10) / 10,
              "g"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => setRecipeComponents((items) => items.filter((item) => item.id !== c.id)),
              className: "rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-400 hover:border-red-400/30 transition",
              children: "Löschen"
            }
          )
        ] }) }, c.id)) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-500", children: "Suche Zutaten und füge sie hinzu, um ein Rezept zu erstellen." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between rounded-2xl bg-sky-400/10 p-4 text-sky-200", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold uppercase tracking-widest", children: "Summe Rezept" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-4 font-bold", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              Math.round(recipeTotals.kcal),
              " kcal"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs self-center opacity-60", children: [
              "P ",
              Math.round(recipeTotals.protein),
              "g · C ",
              Math.round(recipeTotals.carbs),
              "g · F ",
              Math.round(recipeTotals.fat),
              "g"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: () => saveRecipeCatalog.mutate(),
              disabled: saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0,
              className: twMerge(
                "flex-1 rounded-2xl py-4 font-bold transition shadow-lg",
                saveRecipeCatalog.isPending || !recipeName.trim() || recipeComponents.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-sky-300 text-slate-950 hover:bg-sky-200 active:scale-[0.98]"
              ),
              children: saveRecipeCatalog.isPending ? "Speichert…" : "Rezept speichern"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              onClick: clearRecipe,
              className: "rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-300 hover:bg-white/10 transition",
              children: "Reset"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-3xl border border-orange-400/15 bg-orange-400/5 p-6 shadow-glow", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-orange-300", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(UtensilsCrossed, { className: "h-4 w-4" }),
            "Catalog"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-1 text-2xl font-bold tracking-tight text-slate-100", children: "Gerichte-Katalog" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rounded-full border border-white/10 bg-slate-950/70 px-4 py-1.5 text-sm font-medium text-slate-400", children: [
          catalog.length,
          " Einträge"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-8 overflow-auto max-h-[800px] pr-2 custom-scrollbar", children: catalog.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-sm text-slate-500", children: "Keine Gerichte im Katalog." }) : Object.entries(catalogGroups).map(([groupKey, items]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between border-b border-white/5 pb-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "text-xs font-bold uppercase tracking-[0.2em] text-slate-500", children: CATEGORY_LABELS[groupKey] || groupKey }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] text-slate-600 font-bold", children: items.length })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-3", children: items.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group relative rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition-all hover:border-orange-400/30 hover:bg-orange-400/5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-bold text-slate-100 group-hover:text-orange-200", children: item.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500", children: MEAL_LABEL[item.meal_type] || item.meal_type || item.kind })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => deleteCatalogItem.mutate(item.id), className: "opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-red-400", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-4 w-4" }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex gap-4 text-sm font-medium text-slate-400", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-orange-300", children: [
              item.kcal,
              " kcal"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "P ",
              item.protein,
              "g"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "C ",
              item.carbs,
              "g"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "F ",
              item.fat,
              "g"
            ] })
          ] }),
          item.notes && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 text-xs italic text-slate-500", children: item.notes }),
          Array.isArray(item.addons) && item.addons.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 space-y-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600", children: "Add-ons" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-2", children: item.addons.map((addon) => {
              const selectedIds = catalogAddonSelection[item.id] || item.default_addon_ids || [];
              const active = selectedIds.includes(addon.id);
              return /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  onClick: () => toggleCatalogAddon(item.id, addon.id),
                  className: twMerge(
                    "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition",
                    active ? "border-sky-400 bg-sky-400 text-slate-950" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  ),
                  children: addon.label
                },
                addon.id
              );
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 flex gap-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              type: "button",
              onClick: () => logCatalogItem.mutate({
                catalogItemId: item.id,
                addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || []
              }),
              disabled: logCatalogItem.isPending,
              className: "flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-orange-300 transition active:scale-95 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Play, { className: "h-3.5 w-3.5 fill-current" }),
                "Loggen"
              ]
            }
          ) })
        ] }, item.id)) })
      ] }, groupKey)) })
    ] })
  ] }) });
}

export { FoodView as default };
