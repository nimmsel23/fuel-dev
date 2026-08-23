import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { Play, Trash2, Pencil, UtensilsCrossed, Pill } from "lucide-react";
import { fetchJson, postJson, deleteJson } from "@api";
import CatalogItemEditor from "./CatalogItemEditor.jsx";

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

function isoDay(ts) {
  return String(ts || "").slice(0, 10);
}

function formatLastUsed(ts) {
  const day = isoDay(ts);
  if (!day) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return "heute genutzt";
  const then = new Date(`${day}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const diff = Math.round((now - then) / 86400000);
  if (diff === 1) return "gestern genutzt";
  if (diff > 1 && diff < 7) return `vor ${diff} Tagen genutzt`;
  return `${day} genutzt`;
}

function renderSourceLabel(item) {
  if (item.source === "logged") return "aus Verlauf";
  if (item.source === "gemini") return "aus Log erkannt";
  if (item.source === "manual") return "manuell gepflegt";
  return item.source || "Katalog";
}

export default function FoodCatalog({ activeDate }) {
  const qc = useQueryClient();
  const [catalogAddonSelection, setCatalogAddonSelection] = useState({});
  const [catalogGrams, setCatalogGrams] = useState({});
  const [editingItem, setEditingItem] = useState(null);

  function gramsFor(item) {
    return catalogGrams[item.id] ?? item.yield_g ?? "";
  }

  // Skaliert die gespeicherten Makros (die für item.yield_g gelten) linear auf
  // die aktuell gewählte Grammzahl — Makros pro 100g werden hier, beim Client,
  // aus den absoluten Katalog-Werten abgeleitet statt im Kopf umgerechnet.
  function scaledMacros(item) {
    const grams = Number(gramsFor(item)) || 0;
    if (!item.yield_g || !grams) {
      return { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };
    }
    const factor = grams / item.yield_g;
    return {
      kcal: Math.round(item.kcal * factor),
      protein: Math.round(item.protein * factor * 10) / 10,
      carbs: Math.round(item.carbs * factor * 10) / 10,
      fat: Math.round(item.fat * factor * 10) / 10,
    };
  }

  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    // Katalog ist bereits der persistierte Stand (Firestore/Datei) — kein
    // client-seitiges Caching nötig, das nur zusätzliches Staleness-Risiko
    // schafft (siehe Food-Verlauf-Bug: gecachter Stand hinkte trotz
    // korrektem Server-Write hinterher). Immer frisch laden.
    staleTime: 0,
  });
  const catalog = catalogData?.items || [];

  const { data: suppCatalogData } = useQuery({
    queryKey: ["supp-catalog"],
    queryFn: () => fetchJson("/supplements/catalog"),
    staleTime: 300_000,
  });
  const suppCatalog = suppCatalogData?.items || [];
  const recentCatalog = catalog.filter((item) => item.last_used_at).slice(0, 8);
  const recentIds = new Set(recentCatalog.map((item) => item.id));
  const remainingCatalog = catalog.filter((item) => !recentIds.has(item.id));
  const catalogGroups = remainingCatalog.reduce((groups, item) => {
    const key = item.category || item.kind || "meal";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});

  function CatalogCard({ item, compact = false }) {
    const lastUsedLabel = formatLastUsed(item.last_used_at);
    const macros = scaledMacros(item);

    return (
      <div key={item.id} className="group relative rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition-all hover:border-orange-400/30 hover:bg-orange-400/5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate font-bold text-slate-100 group-hover:text-orange-200">{item.name}</div>
              {item.use_count > 1 && (
                <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-orange-200">
                  {item.use_count}x
                </span>
              )}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {MEAL_LABEL[item.meal_type] || item.meal_type || item.kind}
              {item.source_kind === "supplement" && <span className="ml-2 text-sky-500">[SUPP]</span>}
              {Array.isArray(item.linked_supplement_ids) && item.linked_supplement_ids.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-violet-400" title={`Supplement wird automatisch mitgeloggt: ${item.linked_supplement_ids.join(", ")}`}>
                  <Pill className="h-2.5 w-2.5" />
                  {item.linked_supplement_ids.join(" + ")}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <span>{renderSourceLabel(item)}</span>
              {lastUsedLabel && <span className="text-emerald-300/80">{lastUsedLabel}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => setEditingItem(item)}
              className="p-2 text-slate-500 hover:text-sky-400">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => {
              if (window.confirm(`Möchtest du "${item.name}" wirklich unwiderruflich aus dem Katalog löschen?`)) {
                deleteCatalogItem.mutate(item.id);
              }
            }} className="p-2 text-slate-500 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {item.yield_g ? (
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Menge
              <input type="number" min="1"
                value={gramsFor(item)}
                onChange={(e) => setCatalogGrams((cur) => ({ ...cur, [item.id]: e.target.value }))}
                className="w-20 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 text-slate-100" />
              {item.unit || "g"}
            </label>
            <span className="text-[10px] text-slate-600">(gespeichert: {item.yield_g}{item.unit || "g"})</span>
          </div>
        ) : null}

        <div className="mt-3 flex gap-4 text-sm font-medium text-slate-400">
          <span className="text-orange-300">{macros.kcal} kcal</span>
          <span>P {macros.protein}g</span>
          <span>C {macros.carbs}g</span>
          <span>F {macros.fat}g</span>
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
              item,
              addonIds: catalogAddonSelection[item.id] || item.default_addon_ids || [],
              grams: Number(gramsFor(item)) || item.yield_g || null,
              macros,
            })}
            disabled={logCatalogItem.isPending}
            className={twMerge(
              "inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-orange-300 transition active:scale-95 disabled:opacity-50",
              compact ? "w-full" : "flex-1",
            )}>
            <Play className="h-3.5 w-3.5 fill-current" />
            Wieder loggen
          </button>
        </div>
      </div>
    );
  }

  function toggleCatalogAddon(itemId, addonId) {
    setCatalogAddonSelection((cur) => {
      const ids = new Set(cur[itemId] || []);
      if (ids.has(addonId)) ids.delete(addonId); else ids.add(addonId);
      return { ...cur, [itemId]: Array.from(ids) };
    });
  }

  const logCatalogItem = useMutation({
    mutationFn: async ({ item, addonIds = [], grams, macros }) => {
      // 1. Meal loggen
      if (item.yield_g && grams && grams !== item.yield_g) {
        await postJson("/nutrition/log", {
          date: activeDate,
          meal: {
            type: item.meal_type || item.type || "meal",
            description: item.name || item.description,
            notes: item.notes || "",
            grams, catalog_item_id: item.id,
            ...macros,
          },
        });
      } else {
        await postJson("/nutrition/log", {
          date: activeDate, catalog_item_id: item.id, catalog_addon_ids: addonIds,
        });
      }

      // 2. Verknüpfte Supplemente automatisch mitloggen
      const linkedIds = item.linked_supplement_ids || [];
      for (const suppId of linkedIds) {
        const suppEntry = suppCatalog.find((s) => s.id === suppId);
        if (!suppEntry) continue;
        await postJson("/supplements/log", {
          date: activeDate,
          intake: {
            supplement_id: suppEntry.id,
            dose: suppEntry.default_dose ?? 0,
            unit: suppEntry.unit || "g",
            time_of_day: suppEntry.default_time_of_day || "morning",
            notes: `Auto via Meal-Katalog: ${item.name}`,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", activeDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      qc.invalidateQueries({ queryKey: ["supp-log", activeDate] });
      qc.invalidateQueries({ queryKey: ["supp-stats", activeDate] });
    },
  });

  const deleteCatalogItem = useMutation({
    mutationFn: (id) => deleteJson(`/nutrition/catalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] }),
  });

  return (
    <>
      {recentCatalog.length > 0 && (
        <div className="mb-6 rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-6 shadow-glow">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300">
                <UtensilsCrossed className="h-4 w-4" />
                Food-Verlauf
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-100">Zuletzt geloggte Foods</h2>
              <p className="mt-2 text-sm text-slate-400">Eigene Verlauf-Card im Food-Tab für schnellen Reuse der zuletzt verwendeten Einträge.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-1.5 text-sm font-medium text-slate-400">
              {recentCatalog.length} zuletzt genutzt
            </span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {recentCatalog.map((item) => <CatalogCard key={item.id} item={item} compact />)}
          </div>
        </div>
      )}

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
                  {items.map((item) => <CatalogCard key={item.id} item={item} />)}
                </div>
              </section>
            ))
          )}
        </div>

        <CatalogItemEditor
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
        />
      </div>
    </>
  );
}
