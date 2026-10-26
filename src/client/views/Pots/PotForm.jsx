import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { analyzeMealText } from "../../lib/aiMealLogger.js";
import { scanToMeal } from "../../lib/mealDetails.js";
import { PRESETS } from "../../lib/potsLogic.js";
import { todayISO } from "../../lib/db/firestore/utils.js";

const FIELD = "w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-orange-400/50";
const FIRST_CHOICES = [{ value: 0, label: "noch nichts" }, ...PRESETS.filter((p) => [0.25, 0.5, 0.75].includes(p.value)), { value: 1, label: "alles" }];

// Anlegen (ohne `initial`) und Bearbeiten (`initial` = bestehender Topf: kein Kochtag, kein Erst-Anteil).
const str = (v) => (v == null ? "" : String(Math.round(v * 10) / 10));

export default function PotForm({ initial = null, onSubmit, onCancel }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [ingredients, setIngredients] = useState(initial?.ingredients || "");
  const [cookedOn, setCookedOn] = useState(initial?.cooked_on || todayISO());
  const [macros, setMacros] = useState({ kcal: str(initial?.macros?.kcal), protein: str(initial?.macros?.protein), carbs: str(initial?.macros?.carbs), fat: str(initial?.macros?.fat) });
  const [extras, setExtras] = useState(null); // micros / micros_meta / components aus der KI-Schätzung
  const [first, setFirst] = useState(0);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function estimate() {
    setError("");
    setEstimating(true);
    try {
      // Der Topf ist die GESAMTMENGE aller Zutaten, keine Einzelportion.
      const parsed = await analyzeMealText(`GESAMTER TOPF (alle Portionen zusammen, NICHT eine Einzelportion; Zutaten wie genannt zubereitet): ${ingredients}`);
      const meal = scanToMeal(parsed);
      setMacros({ kcal: String(Math.round(meal.kcal)), protein: String(Math.round(meal.protein)), carbs: String(Math.round(meal.carbs)), fat: String(Math.round(meal.fat)) });
      setExtras({ micros: meal.micros, micros_meta: meal.micros_meta, components: meal.components });
      if (!name.trim() && meal.description) setName(meal.description);
    } catch (e) {
      setError(e?.message || "Schätzung fehlgeschlagen.");
    } finally {
      setEstimating(false);
    }
  }

  const num = (v) => Number(String(v).replace(",", ".")) || 0;
  const valid = name.trim() && num(macros.kcal) > 0;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        name, ingredients, cooked_on: cookedOn,
        macros: { kcal: num(macros.kcal), protein: num(macros.protein), carbs: num(macros.carbs), fat: num(macros.fat) },
        extras, // null, solange nicht neu geschätzt wurde
      }, first);
    } catch (err) {
      setError(err?.message || "Speichern fehlgeschlagen.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-orange-400/20 bg-orange-400/5 p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Name des Gerichts</span>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Jasmins speckige Reiseier" />
        </label>
        {!editing && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Gekocht am</span>
            <input type="date" className={FIELD} value={cookedOn} max={todayISO()} onChange={(e) => setCookedOn(e.target.value)} />
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">Was ist alles drin? (Gesamtmenge des Topfs)</span>
        <textarea rows={3} className={FIELD} value={ingredients} onChange={(e) => setIngredients(e.target.value)}
          placeholder="3 kleine Tassen Jasminreis, 1 Zwiebel, 5 Eier, 20 dag Jausenspeck" />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">Nährwerte für den ganzen Topf</span>
          <button type="button" onClick={estimate} disabled={estimating || !ingredients.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-400/10 px-2.5 py-1 text-xs font-semibold text-orange-200 transition hover:bg-orange-400/20 disabled:opacity-40">
            {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Per KI schätzen
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["kcal", "kcal"], ["protein", "Protein g"], ["carbs", "Carbs g"], ["fat", "Fett g"]].map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
              <input type="number" inputMode="decimal" min={0} className={FIELD} value={macros[k]} onChange={(e) => setMacros({ ...macros, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>

      {!editing && <div>
        <span className="mb-1.5 block text-xs text-slate-400">Davon schon gegessen (am Kochtag)</span>
        <div className="flex flex-wrap gap-1.5">
          {FIRST_CHOICES.map((c) => (
            <button key={c.label} type="button" onClick={() => setFirst(c.value)}
              className={twMerge("rounded-lg border px-2.5 py-1 text-sm font-semibold transition",
                first === c.value ? "border-orange-400/60 bg-orange-400/20 text-orange-200" : "border-white/10 text-slate-300 hover:bg-white/10")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>}
      {editing && <p className="text-xs text-slate-500">Geänderte Werte werden auf alle schon geloggten Tagesanteile übertragen.</p>}

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:text-slate-200">Abbrechen</button>
        <button type="submit" disabled={!valid || saving}
          className="rounded-xl bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-300 disabled:opacity-40">
          {saving ? "Speichere…" : editing ? "Speichern" : "Topf anlegen"}
        </button>
      </div>
    </form>
  );
}
