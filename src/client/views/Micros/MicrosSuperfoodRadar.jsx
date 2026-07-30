import React, { useState } from "react";
import { Sparkles, ShieldAlert, Award, ChevronRight, Apple, Flame, Info } from "lucide-react";
import { NUTRIENTS } from "./utils.js";

const SUPERFOOD_MAP = {
  vitamin_a_ug: {
    name: "Vitamin A",
    foods: [
      { name: "Karotten", portion: "100g", amount: "835 µg", icon: "🥕" },
      { name: "Süßkartoffel", portion: "100g", amount: "960 µg", icon: "🍠" },
      { name: "Spinat", portion: "100g", amount: "470 µg", icon: "🥬" },
    ],
    tip: "Pro-Vitamin A (Beta-Carotin) am besten mit etwas gesundem Fett (z.B. Olivenöl) verzehren."
  },
  vitamin_d_ug: {
    name: "Vitamin D",
    foods: [
      { name: "Wildlachs", portion: "100g", amount: "16 µg", icon: "🐟" },
      { name: "Hühnereigelb", portion: "2 Stück", amount: "3 µg", icon: "🥚" },
      { name: "Sonnengetrocknete Pilze", portion: "50g", amount: "5 µg", icon: "🍄" },
    ],
    tip: "In mitteleuropäischen Breiten im Winter oft schwer allein über Nahrung abzudecken."
  },
  vitamin_e_mg: {
    name: "Vitamin E",
    foods: [
      { name: "Sonnenblumenkerne", portion: "30g", amount: "11 mg", icon: "🌻" },
      { name: "Mandeln", portion: "30g", amount: "7.5 mg", icon: "🥜" },
      { name: "Weizenkeimöl", portion: "1 EL (10ml)", amount: "15 mg", icon: "🫒" },
    ],
    tip: "Schützt als starkes Antioxidans die Zellmembranen vor freiem oxidativen Stress."
  },
  vitamin_k_ug: {
    name: "Vitamin K",
    foods: [
      { name: "Grünkohl", portion: "100g", amount: "700 µg", icon: "🥬" },
      { name: "Petersilie", portion: "20g", amount: "160 µg", icon: "🌿" },
      { name: "Brokkoli", portion: "150g", amount: "150 µg", icon: "🥦" },
    ],
    tip: "Wichtig für die Blutgerinnung und den Transport von Calcium in die Knochen."
  },
  vitamin_c_mg: {
    name: "Vitamin C",
    foods: [
      { name: "Rote Paprika", portion: "1 Stück (150g)", amount: "210 mg", icon: "🫑" },
      { name: "Hagebutten / Acerola", portion: "20g", amount: "250 mg", icon: "🍒" },
      { name: "Kiwi & Zitrusfrüchte", portion: "2 Stück", amount: "120 mg", icon: "🥝" },
    ],
    tip: "Hitzeempfindlich! Paprika oder Beeren vorzugsweise roh oder leicht gedünstet essen."
  },
  vitamin_b1_mg: {
    name: "Vitamin B1",
    foods: [
      { name: "Sonnenblumenkerne", portion: "30g", amount: "0.4 mg", icon: "🌻" },
      { name: "Haferflocken", portion: "80g", amount: "0.5 mg", icon: "🥣" },
      { name: "Schweinefilet / Vollkorn", portion: "150g", amount: "0.9 mg", icon: "🌾" },
    ],
    tip: "Essenziell für den Kohlenhydratstoffwechsel und die Nervenfunktion."
  },
  vitamin_b2_mg: {
    name: "Vitamin B2",
    foods: [
      { name: "Mandeln", portion: "30g", amount: "0.3 mg", icon: "🥜" },
      { name: "Speisequark 20%", portion: "250g", amount: "0.7 mg", icon: "🥣" },
      { name: "Champignons", portion: "150g", amount: "0.6 mg", icon: "🍄" },
    ],
    tip: "Wichtig für Energieproduktion in den Mitochondrien und gesunde Haut."
  },
  vitamin_b3_mg: {
    name: "Vitamin B3",
    foods: [
      { name: "Hähnchenbrust", portion: "150g", amount: "15 mg", icon: "🍗" },
      { name: "Erdnüsse", portion: "40g", amount: "6 mg", icon: "🥜" },
      { name: "Lachs", portion: "150g", amount: "11 mg", icon: "🐟" },
    ],
    tip: "Unterstützt Zellerneuerung, Muskelstoffwechsel und DNA-Reparatur."
  },
  vitamin_b5_mg: {
    name: "Vitamin B5",
    foods: [
      { name: "Avocado", portion: "1 Stück", amount: "2 mg", icon: "🥑" },
      { name: "Eier", portion: "2 Stück", amount: "1.5 mg", icon: "🥚" },
      { name: "Vollkorngetreide", portion: "100g", amount: "1.2 mg", icon: "🌾" },
    ],
    tip: "Schlüsselbaustein von Coenzym A für Fett- und Energiestoffwechsel."
  },
  vitamin_b6_mg: {
    name: "Vitamin B6",
    foods: [
      { name: "Bananen", portion: "2 Stück", amount: "0.7 mg", icon: "🍌" },
      { name: "Kartoffeln", portion: "250g", amount: "0.8 mg", icon: "🥔" },
      { name: "Putenbrust", portion: "150g", amount: "0.9 mg", icon: "🍗" },
    ],
    tip: "Entscheidend für Eiweißbausteine (Aminosäuren) und Neurotransmitter."
  },
  vitamin_b7_ug: {
    name: "Vitamin B7 (Biotin)",
    foods: [
      { name: "Haferflocken", portion: "80g", amount: "16 µg", icon: "🥣" },
      { name: "Eigelb", portion: "2 Stück", amount: "25 µg", icon: "🥚" },
      { name: "Walnüsse", portion: "30g", amount: "11 µg", icon: "🌰" },
    ],
    tip: "Fördert Kräftigung von Haaren, Nägeln und gesunder Haut."
  },
  folate_ug: {
    name: "Folat (B9)",
    foods: [
      { name: "Bio-Spinat", portion: "100g", amount: "145 µg", icon: "🥬" },
      { name: "Kichererbsen", portion: "150g", amount: "260 µg", icon: "🧆" },
      { name: "Grüner Spargel", portion: "150g", amount: "160 µg", icon: "🌱" },
    ],
    tip: "Natürliches Folat ist wasserlöslich — Wasser beim Kochen mitverwenden oder dünsten."
  },
  vitamin_b12_ug: {
    name: "Vitamin B12",
    foods: [
      { name: "Nährhefe (Edelhefe)", portion: "2 EL (10g)", amount: "4 µg", icon: "🧄" },
      { name: "Wildlachs", portion: "150g", amount: "4.5 µg", icon: "🐟" },
      { name: "Eier", portion: "2 Stück", amount: "2 µg", icon: "🥚" },
    ],
    tip: "Unerlässlich für Nervensystem und Blutbildung. Bei veganer Ernährung gezielt zuführen."
  },
  calcium_mg: {
    name: "Calcium",
    foods: [
      { name: "Sesam / Tahin", portion: "30g", amount: "290 mg", icon: "🫓" },
      { name: "Chia-Samen", portion: "30g", amount: "180 mg", icon: "🌱" },
      { name: "Parmesan / Hartkäse", portion: "40g", amount: "480 mg", icon: "🧀" },
    ],
    tip: "Optimale Aufnahme in Kombination mit Vitamin D3 und K2."
  },
  phosphorus_mg: {
    name: "Phosphor",
    foods: [
      { name: "Kürbiskerne", portion: "30g", amount: "350 mg", icon: "🎃" },
      { name: "Haferflocken", portion: "80g", amount: "320 mg", icon: "🥣" },
      { name: "Linsen", portion: "150g", amount: "270 mg", icon: "🍲" },
    ],
    tip: "Bestandteil von ATP (Energiewährung der Zelle) und Knochensubstanz."
  },
  magnesium_mg: {
    name: "Magnesium",
    foods: [
      { name: "Kürbiskerne", portion: "40g", amount: "210 mg", icon: "🎃" },
      { name: "Zartbitterschokolade (>85%)", portion: "40g", amount: "90 mg", icon: "🍫" },
      { name: "Mandeln", portion: "40g", amount: "105 mg", icon: "🥜" },
    ],
    tip: "Wirkt entkrampfend auf Muskeln und entspannend auf das Nervensystem vor dem Schlafen."
  },
  iron_mg: {
    name: "Eisen",
    foods: [
      { name: "Kürbiskerne", portion: "30g", amount: "3.8 mg", icon: "🎃" },
      { name: "Sesam & Quinoa", portion: "50g", amount: "3.7 mg", icon: "🌾" },
      { name: "Rotes Fleisch / Leber", portion: "120g", amount: "4.2 mg", icon: "🥩" },
    ],
    tip: "Pflanzliches Eisen immer zusammen mit Vitamin C kombinieren, um die Aufnahme zu verdreifachen."
  },
  zinc_mg: {
    name: "Zink",
    foods: [
      { name: "Kürbiskerne", portion: "40g", amount: "3.2 mg", icon: "🎃" },
      { name: "Rindfleisch / Magerfleisch", portion: "150g", amount: "6.5 mg", icon: "🥩" },
      { name: "Linsen & Kichererbsen", portion: "150g gekocht", amount: "2.4 mg", icon: "🧆" },
    ],
    tip: "Essentiell für Immunsystem, Wundheilung und hormonelles Gleichgewicht."
  },
  selenium_ug: {
    name: "Selen",
    foods: [
      { name: "Parannüsse", portion: "2 Stück (8g)", amount: "70 µg", icon: "🌰" },
      { name: "Thunfisch / Lachs", portion: "150g", amount: "60 µg", icon: "🐟" },
      { name: "Eier", portion: "2 Stück", amount: "30 µg", icon: "🥚" },
    ],
    tip: "Schon 1-2 Parannüsse pro Tag decken den gesamten Tagesbedarf an Selen."
  },
  iodine_ug: {
    name: "Jod",
    foods: [
      { name: "Nori-Algen", portion: "2g (1 Blatt)", amount: "100 µg", icon: "🍙" },
      { name: "Kabeljau / Seelachs", portion: "150g", amount: "170 µg", icon: "🐟" },
      { name: "Jodiertes Speisesalz", portion: "3g", amount: "60 µg", icon: "🧂" },
    ],
    tip: "Unerlässlich für Schilddrüsenhormone und Stoffwechselaktivität."
  },
  potassium_mg: {
    name: "Kalium",
    foods: [
      { name: "Bananen", portion: "2 Stück", amount: "800 mg", icon: "🍌" },
      { name: "Avocado", portion: "1 Stück", amount: "950 mg", icon: "🥑" },
      { name: "Kartoffeln mit Schale", portion: "250g", amount: "1050 mg", icon: "🥔" },
    ],
    tip: "Reguliert den zellulären Flüssigkeitshaushalt und wirkt ausgleichend zu Natrium."
  },
  sodium_mg: {
    name: "Natrium",
    foods: [
      { name: "Meersalz / Mineralwasser", portion: "1.5g", amount: "600 mg", icon: "🧂" },
      { name: "Oliven", portion: "50g", amount: "700 mg", icon: "🫒" },
    ],
    tip: "Wichtig für Elektrolythaushalt und Muskelkontraktionen."
  },
  boron_mg: {
    name: "Bor",
    foods: [
      { name: "Trockenpflaumen / Rosinen", portion: "40g", amount: "1.1 mg", icon: "🍇" },
      { name: "Haselnüsse", portion: "30g", amount: "0.6 mg", icon: "🌰" },
      { name: "Äpfel & Birnen", portion: "2 Stück", amount: "0.8 mg", icon: "🍎" },
    ],
    tip: "Unterstützt den Calcium- & Magnesiumstoffwechsel in den Knochen."
  },
  omega3_mg: {
    name: "Omega-3",
    foods: [
      { name: "Wildlachs", portion: "150g", amount: "1800 mg", icon: "🐟" },
      { name: "Walnüsse", portion: "30g", amount: "2600 mg", icon: "🌰" },
      { name: "Leinöl / Chia-Samen", portion: "1 EL (10ml)", amount: "2400 mg", icon: "🌿" },
    ],
    tip: "Stark entzündungshemmende Fettsäuren für Herz, Gehirn und Gelenke."
  }
};

export default function MicrosSuperfoodRadar({ results }) {
  const [selectedNutrient, setSelectedNutrient] = useState(null);

  // Compute averages for each nutrient across loaded query results
  const nutrientStats = NUTRIENTS.map(({ key, label, unit }) => {
    let sumPct = 0;
    let count = 0;
    let sumAvg = 0;
    let dachVal = 0;

    results.forEach((res) => {
      const comp = res.data?.rda_comparison?.[key];
      if (comp && comp.percent_of_dach != null) {
        sumPct += comp.percent_of_dach;
        sumAvg += comp.avg_daily || 0;
        dachVal = comp.dach || 0;
        count++;
      }
    });

    const avgPct = count > 0 ? Math.round(sumPct / count) : null;
    const avgDaily = count > 0 ? Math.round((sumAvg / count) * 10) / 10 : null;

    return {
      key,
      label,
      unit,
      avgPct,
      avgDaily,
      dachVal,
      superfood: SUPERFOOD_MAP[key],
    };
  });

  // Calculate overall balance score
  const validPcts = nutrientStats.map((n) => n.avgPct).filter((p) => p != null);
  const overallBalance = validPcts.length > 0
    ? Math.round(validPcts.reduce((a, b) => a + b, 0) / validPcts.length)
    : null;

  // Filter low / critical nutrients (< 85% DACH average or sorted lowest)
  const lowNutrients = nutrientStats
    .filter((n) => n.avgPct != null && n.avgPct < 85)
    .sort((a, b) => a.avgPct - b.avgPct);

  const activeNutrient = selectedNutrient
    ? nutrientStats.find((n) => n.key === selectedNutrient)
    : lowNutrients[0] || nutrientStats[0];

  return (
    <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-violet-950/20 p-6 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 shadow-inner">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-widest text-violet-400">Smart Radar</span>
              <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-300">DACH Optimizer</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mt-0.5">Superfood & Defizit-Empfehlungen</h3>
          </div>
        </div>

        {overallBalance != null && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 shrink-0">
            <Award className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Gesamt-Abdeckung</div>
              <div className="text-lg font-black text-slate-100">{overallBalance}% DACH</div>
            </div>
          </div>
        )}
      </div>

      {/* Low Nutrients Overview Chips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            {lowNutrients.length > 0 ? `Nährstoffe mit Lücken (${lowNutrients.length})` : "Alle Nährstoffe im Blick"}
          </span>
          <span className="text-[11px] text-slate-500">Klick zum Auswählen</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {nutrientStats.slice(0, 12).map((n) => {
            const isSelected = activeNutrient?.key === n.key;
            const isLow = n.avgPct != null && n.avgPct < 85;

            return (
              <button
                key={n.key}
                onClick={() => setSelectedNutrient(n.key)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-violet-600 text-white ring-2 ring-violet-400/50 shadow-lg scale-[1.02]"
                    : isLow
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                    : "bg-slate-800/60 border border-white/5 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{n.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : isLow
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-slate-700 text-slate-400"
                }`}>
                  {n.avgPct != null ? `${n.avgPct}%` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Nutrient Superfood Card */}
      {activeNutrient && activeNutrient.superfood && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300 font-bold text-lg">
                <Apple className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-100">{activeNutrient.superfood.name} ({activeNutrient.label})</h4>
                <p className="text-xs text-slate-400">
                  Tages-Ø: <strong className="text-slate-200">{activeNutrient.avgDaily || 0} {activeNutrient.unit}</strong> von empfohlener DACH-Menge <strong className="text-slate-200">{activeNutrient.dachVal} {activeNutrient.unit}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-2.5 w-32 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (activeNutrient.avgPct || 0) >= 90
                      ? "bg-emerald-500"
                      : (activeNutrient.avgPct || 0) >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, activeNutrient.avgPct || 0)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-200">{activeNutrient.avgPct || 0}%</span>
            </div>
          </div>

          {/* Superfood items grid */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-3 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              Top Natürliche Quellen & Superfoods
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {activeNutrient.superfood.foods.map((food, idx) => (
                <div key={idx} className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 flex flex-col justify-between hover:border-violet-500/30 transition-all hover:bg-slate-900">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-2xl">{food.icon}</span>
                    <span className="rounded-md bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      {food.amount}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">{food.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Portion: {food.portion}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip Box */}
          {activeNutrient.superfood.tip && (
            <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3.5 text-xs text-violet-200">
              <Info className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
              <div>
                <strong className="font-semibold">Ernährungs-Tipp: </strong>
                {activeNutrient.superfood.tip}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
