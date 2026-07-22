import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { Trash2 } from "lucide-react";
import { postJson } from "@api";
import { Modal } from "../../components/ui.jsx";
import FoodSearch from "../../components/FoodSearch.jsx";

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const smallInputCls = "w-full rounded-xl border border-white/10 bg-slate-900/70 px-2.5 py-1.5 text-sm text-slate-100";

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function newAddonId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CatalogItemEditor({ item, open, onOpenChange }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [notes, setNotes] = useState("");
  const [yieldGrams, setYieldGrams] = useState("");
  const [components, setComponents] = useState([]);
  const [macros, setMacros] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [addons, setAddons] = useState([]);
  const [defaultAddonIds, setDefaultAddonIds] = useState([]);

  useEffect(() => {
    if (!item) return;
    setName(item.name || "");
    setMealType(item.meal_type || "breakfast");
    setNotes(item.notes || "");
    setYieldGrams(item.yield_g ?? "");
    setComponents(item.components || []);
    setMacros({
      kcal: item.kcal ?? 0, protein: item.protein ?? 0,
      carbs: item.carbs ?? 0, fat: item.fat ?? 0,
    });
    setAddons(item.addons || []);
    setDefaultAddonIds(item.default_addon_ids || []);
  }, [item]);

  const hasComponents = components.length > 0;
  const totals = hasComponents
    ? components.reduce(
        (acc, c) => ({
          kcal:    acc.kcal    + (Number(c.kcal)    || 0),
          protein: acc.protein + (Number(c.protein) || 0),
          carbs:   acc.carbs   + (Number(c.carbs)   || 0),
          fat:     acc.fat     + (Number(c.fat)      || 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      )
    : macros;

  function addComponent(component) {
    setComponents((items) => [...items, {
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      label: component.description || component.name,
      description: component.description || component.name,
      brand: component.brand || "", grams: component.grams ?? null,
      kcal: component.kcal ?? 0, protein: component.protein ?? 0,
      carbs: component.carbs ?? 0, fat: component.fat ?? 0,
      source: component.source || "off", source_kind: "food",
    }]);
  }

  function updateAddon(id, patch) {
    setAddons((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addAddon() {
    setAddons((cur) => [...cur, { id: newAddonId(), label: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }]);
  }

  function removeAddon(id) {
    setAddons((cur) => cur.filter((a) => a.id !== id));
    setDefaultAddonIds((cur) => cur.filter((aid) => aid !== id));
  }

  function toggleDefaultAddon(id) {
    setDefaultAddonIds((cur) => (cur.includes(id) ? cur.filter((aid) => aid !== id) : [...cur, id]));
  }

  const saveEdit = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", {
      item: {
        id: item.id,
        kind: item.kind,
        category: item.category,
        name: name.trim(),
        description: name.trim(),
        meal_type: mealType,
        notes,
        kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat,
        yield_g: Number(yieldGrams) || null,
        components,
        addons,
        default_addon_ids: defaultAddonIds,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      onOpenChange(false);
    },
  });

  if (!item) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`"${item.name}" bearbeiten`}>
      <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mahlzeit-Typ">
            <select className={inputCls} value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notizen">
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Gesamtgewicht (g)">
            <input type="number" min="0" className={inputCls}
              value={yieldGrams} onChange={(e) => setYieldGrams(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-100 uppercase tracking-widest">Zutaten</strong>
          </div>
          <FoodSearch onSelect={addComponent} />
          {hasComponents ? (
            <div className="mt-3 grid gap-2">
              {components.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{c.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {c.grams != null ? `${c.grams} g · ` : ""}
                        {Math.round(c.kcal)} kcal · P {Math.round(c.protein * 10) / 10}g · C {Math.round(c.carbs * 10) / 10}g · F {Math.round(c.fat * 10) / 10}g
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setComponents((items) => items.filter((x) => x.id !== c.id))}
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-red-400 hover:border-red-400/30 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Keine Zutaten hinterlegt — Makros unten direkt bearbeitbar.
            </p>
          )}
        </div>

        {!hasComponents && (
          <div className="grid grid-cols-4 gap-2">
            <Field label="Kcal">
              <input type="number" className={inputCls} value={macros.kcal}
                onChange={(e) => setMacros((m) => ({ ...m, kcal: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Protein">
              <input type="number" className={inputCls} value={macros.protein}
                onChange={(e) => setMacros((m) => ({ ...m, protein: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Carbs">
              <input type="number" className={inputCls} value={macros.carbs}
                onChange={(e) => setMacros((m) => ({ ...m, carbs: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Fett">
              <input type="number" className={inputCls} value={macros.fat}
                onChange={(e) => setMacros((m) => ({ ...m, fat: Number(e.target.value) || 0 }))} />
            </Field>
          </div>
        )}

        {hasComponents && (
          <div className="flex flex-wrap items-center justify-between rounded-2xl bg-sky-400/10 p-4 text-sky-200">
            <span className="text-sm font-semibold uppercase tracking-widest">Summe Zutaten</span>
            <div className="flex gap-4 font-bold">
              <span>{Math.round(totals.kcal)} kcal</span>
              <span className="text-xs self-center opacity-60">P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g</span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-100 uppercase tracking-widest">Add-ons</strong>
            <button type="button" onClick={addAddon}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition">
              + Add-on hinzufügen
            </button>
          </div>
          {addons.length === 0 ? (
            <p className="text-xs text-slate-500">Keine Add-ons.</p>
          ) : (
            <div className="grid gap-2">
              {addons.map((a) => (
                <div key={a.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                  <div className="flex items-center gap-2">
                    <input className={twMerge(smallInputCls, "flex-1")} placeholder="Label"
                      value={a.label} onChange={(e) => updateAddon(a.id, { label: e.target.value })} />
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-[10px] uppercase tracking-wider text-slate-400">
                      <input type="checkbox" checked={defaultAddonIds.includes(a.id)}
                        onChange={() => toggleDefaultAddon(a.id)} />
                      Standard
                    </label>
                    <button type="button" onClick={() => removeAddon(a.id)}
                      className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-red-400 hover:border-red-400/30 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <input type="number" className={smallInputCls} placeholder="Kcal" value={a.kcal}
                      onChange={(e) => updateAddon(a.id, { kcal: Number(e.target.value) || 0 })} />
                    <input type="number" className={smallInputCls} placeholder="Protein" value={a.protein}
                      onChange={(e) => updateAddon(a.id, { protein: Number(e.target.value) || 0 })} />
                    <input type="number" className={smallInputCls} placeholder="Carbs" value={a.carbs}
                      onChange={(e) => updateAddon(a.id, { carbs: Number(e.target.value) || 0 })} />
                    <input type="number" className={smallInputCls} placeholder="Fett" value={a.fat}
                      onChange={(e) => updateAddon(a.id, { fat: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => saveEdit.mutate()}
            disabled={saveEdit.isPending || !name.trim()}
            className={twMerge("flex-1 rounded-2xl py-3.5 font-bold transition shadow-lg",
              saveEdit.isPending || !name.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-sky-300 text-slate-950 hover:bg-sky-200 active:scale-[0.98]",
            )}>
            {saveEdit.isPending ? "Speichert…" : "Änderungen speichern"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition">
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}
