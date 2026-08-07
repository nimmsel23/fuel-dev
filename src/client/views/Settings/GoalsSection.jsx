import { useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { useSettings } from "../../store.js";

const defaultSectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
const defaultLabelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const defaultInputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

// % der nach Protein verbleibenden kcal, die als Carbs gerechnet werden
// (Rest = Fett) — gängige Splits, kein Anspruch auf Vollständigkeit.
const CARB_RATIO_PRESETS = [
  { value: 70, label: "High-Carb / Ausdauer — 70% Carbs, 30% Fett" },
  { value: 50, label: "Balanced — 50% Carbs, 50% Fett" },
  { value: 25, label: "Low-Carb — 25% Carbs, 75% Fett" },
  { value: 10, label: "Keto — 10% Carbs, 90% Fett" },
];

// Carbs/Fett-Ziel aus kcal_goal + protein_goal + carb_ratio ableiten —
// einzige Stelle, die diese Rechnung macht (auch von MacroTrendChart genutzt).
export function computeMacroGoals({ kcal_goal, protein_goal, carb_ratio }) {
  const remaining_kcal = Math.max(0, (kcal_goal || 0) - (protein_goal || 0) * 4);
  const ratio = carb_ratio ?? 50;
  return {
    carbs_goal: Math.round((remaining_kcal * ratio / 100) / 4),
    fat_goal: Math.round((remaining_kcal * (100 - ratio) / 100) / 9),
  };
}

const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sitzend (kaum Bewegung)" },
  { value: 1.4, label: "Leicht aktiv (Alltag + Spaziergänge)" },
  { value: 1.6, label: "Aktiv (Krafttraining + Bewegung)" },
  { value: 1.8, label: "Sehr aktiv (tägliches Training)" },
  { value: 2.0, label: "Athlet (2× täglich / körperliche Arbeit)" },
];

const PROTEIN_SCHOOLS = [
  { value: 0.8, label: "0,8 g/kg — DGE-Minimum" },
  { value: 1.2, label: "1,2 g/kg — aktiv, moderat" },
  { value: 1.6, label: "1,6 g/kg — Krafttraining (Evidenz-Sweetspot)" },
  { value: 2.0, label: "2,0 g/kg — Muskelaufbau ambitioniert" },
  { value: 2.4, label: "2,4 g/kg — Diät/Cut (Muskelschutz)" },
];

/**
 * Mifflin-St-Jeor-Grundumsatz × Aktivitätsfaktor → Tagesziele.
 * Wasser: 35 ml/kg Körpergewicht (grobe Sporternährungs-Faustregel).
 */
export function computeGoals({ age, gender, height_cm, weight_kg, activity_level, protein_per_kg }) {
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (gender === "f" ? -161 : 5);
  return {
    kcal_goal: Math.round((bmr * activity_level) / 10) * 10,
    protein_goal: Math.round(weight_kg * protein_per_kg),
    water_goal: Math.round((weight_kg * 35) / 250) * 250,
  };
}

/**
 * Tagesziele (kcal / Protein / Wasser) — fuel-spezifische Settings-Sektion.
 * Standalone via GoalsCard in SettingsView komponiert, von vitalos direkt importiert.
 * Auto-Modus leitet die Ziele aus dem Körperprofil ab (Alter/Geschlecht/Größe/
 * Gewicht kommen im Shell-Betrieb aus dem VitalOS-Körperprofil gespiegelt).
 */
export default function GoalsSection({
  className = defaultSectionCls,
  labelCls = defaultLabelCls,
  inputCls = defaultInputCls,
}) {
  const {
    kcal_goal, protein_goal, water_goal, carb_ratio,
    age, gender, height_cm, weight_kg, activity_level, protein_per_kg,
    setSetting,
  } = useSettings();
  const [showAuto, setShowAuto] = useState(false);

  const suggested = computeGoals({ age, gender, height_cm, weight_kg, activity_level, protein_per_kg });
  const { carbs_goal, fat_goal } = computeMacroGoals({ kcal_goal, protein_goal, carb_ratio });
  const applySuggestion = () => {
    setSetting("kcal_goal", suggested.kcal_goal);
    setSetting("protein_goal", suggested.protein_goal);
    setSetting("water_goal", suggested.water_goal);
  };

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-semibold">Tagesziele</h2>
        </div>
        <button
          onClick={() => setShowAuto(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${showAuto ? "border-orange-400/50 text-orange-300 bg-orange-400/10" : "border-white/10 text-slate-400 hover:text-slate-200"}`}
        >
          <Sparkles size={12} /> Auto
        </button>
      </div>

      {showAuto && (
        <div className="grid gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4">
          <p className="text-xs text-slate-400">
            Basis: {age} J · {gender === "f" ? "W" : "M"} · {height_cm} cm · {weight_kg} kg
            (aus dem Körperprofil) — Mifflin-St-Jeor × Aktivität.
          </p>
          <div>
            <label className={labelCls}>Aktivitätslevel</label>
            <select
              value={activity_level}
              onChange={e => setSetting("activity_level", Number(e.target.value))}
              className={inputCls}
            >
              {ACTIVITY_LEVELS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Protein-Schule</label>
            <select
              value={protein_per_kg}
              onChange={e => setSetting("protein_per_kg", Number(e.target.value))}
              className={inputCls}
            >
              {PROTEIN_SCHOOLS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-300 font-semibold">
              → {suggested.kcal_goal} kcal · {suggested.protein_goal} g Protein · {suggested.water_goal} ml
            </p>
            <button
              onClick={applySuggestion}
              className="px-4 py-2 rounded-xl bg-orange-400/20 border border-orange-400/40 text-orange-200 text-[10px] font-black uppercase tracking-widest hover:bg-orange-400/30 transition-all shrink-0"
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        <div>
          <label className={labelCls}>Kalorien (kcal)</label>
          <input
            type="number" value={kcal_goal} min={500} max={6000}
            onChange={e => setSetting("kcal_goal", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Protein (g)</label>
          <input
            type="number" value={protein_goal} min={30} max={400}
            onChange={e => setSetting("protein_goal", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Makro-Split (Carbs/Fett)</label>
          <select
            value={carb_ratio}
            onChange={e => setSetting("carb_ratio", Number(e.target.value))}
            className={inputCls}
          >
            {CARB_RATIO_PRESETS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Protein bleibt fix ({protein_goal} g) — der Split gilt für die restlichen kcal.
            → {carbs_goal} g Carbs · {fat_goal} g Fett
          </p>
        </div>
        <div>
          <label className={labelCls}>Wasser (ml)</label>
          <input
            type="number" value={water_goal} min={500} max={6000} step={250}
            onChange={e => setSetting("water_goal", Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>
    </section>
  );
}
