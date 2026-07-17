import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { Play, Trash2, UtensilsCrossed } from "lucide-react";
import { fetchJson, postJson, deleteJson } from "@api";

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

export default function FoodCatalog({ activeDate }) {
  const qc = useQueryClient();
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

  function toggleCatalogAddon(itemId, addonId) {
    setCatalogAddonSelection((cur) => {
      const ids = new Set(cur[itemId] || []);
      if (ids.has(addonId)) ids.delete(addonId); else ids.add(addonId);
      return { ...cur, [itemId]: Array.from(ids) };
    });
  }

  const logCatalogItem = useMutation({
    mutationFn: ({ catalogItemId, addonIds = [] }) => postJson("/nutrition/log", {
      date: activeDate, catalog_item_id: catalogItemId, catalog_addon_ids: addonIds,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
    },
  });

  const deleteCatalogItem = useMutation({
    mutationFn: (id) => deleteJson(`/nutrition/catalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] }),
  });

  return (
    <div className="rounded-3xl border border-orange-400/15 bg-orange-400/5 p-6 shadow-glow">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-orange-300">
            <UtensilsCrossed className="h-4 w-4" />
            Catalog
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">Gerichte-Katalog</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-1.5 text-sm font-medium text-slate-400">
          {catalog.length} Einträge
        </span>
      </div>

      <div className="space-y-8 overflow-auto max-h-[800px] pr-2 custom-scrollbar">
        {catalog.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-sm text-slate-500">
            Keine Gerichte im Katalog.
          </p>
        ) : (
          Object.entries(catalogGroups).map(([groupKey, items]) => (
            <section key={groupKey} className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {CATEGORY_LABELS[groupKey] || groupKey}
                </h4>
                <span className="text-[10px] text-slate-600 font-bold">{items.length}</span>
              </div>
              <div className="grid gap-3">
                {items.map((item) => (
                  <div key={item.id} className="group relative rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition-all hover:border-orange-400/30 hover:bg-orange-400/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-100 group-hover:text-orange-200">{item.name}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {MEAL_LABEL[item.meal_type] || item.meal_type || item.kind}
                        </div>
                      </div>
                      <button onClick={() => {
                        if (window.confirm(`Möchtest du "${item.name}" wirklich unwiderruflich aus dem Katalog löschen?`)) {
                          deleteCatalogItem.mutate(item.id);
                        }
                      }} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="mt-3 flex gap-4 text-sm font-medium text-slate-400">
                      <span className="text-orange-300">{item.kcal} kcal</span>
                      <span>P {item.protein}g</span>
                      <span>C {item.carbs}g</span>
                      <span>F {item.fat}g</span>
                    </div>

                    {item.notes && <div className="mt-2 text-xs italic text-slate-500">{item.notes}</div>}

                    {Array.isArray(item.addons) && item.addons.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Add-ons</div>
                        <div className="flex flex-wrap gap-2">
                          {item.addons.map((addon) => {
                            const selectedIds = catalogAddonSelection[item.id] || item.default_addon_ids || [];
                            const active = selectedIds.includes(addon.id);
                            return (
                              <button key={addon.id} type="button"
                                onClick={() => toggleCatalogAddon(item.id, addon.id)}
                                className={twMerge(
                                  "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition",
                                  active
                                    ? "border-sky-400 bg-sky-400 text-slate-950"
                                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10",
                                )}>
                                {addon.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button type="button"
                        onClick={() => logCatalogItem.mutate({
                          catalogItemId: item.id,
                          addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || [],
                        })}
                        disabled={logCatalogItem.isPending}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-orange-300 transition active:scale-95 disabled:opacity-50">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Loggen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
