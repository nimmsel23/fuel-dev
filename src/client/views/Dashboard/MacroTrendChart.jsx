import { TrendingUp } from "lucide-react";
import { ComposedChart, Bar, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useSettings } from "../../store.js";
import { computeMacroGoals } from "../Settings/GoalsSection.jsx";

// kcal (Balken) und Makros (Linien, Gramm) laufen auf zwei getrennten
// Y-Achsen — eine gemeinsame %-Achse für beide war der eigentliche Fehler
// (kcal-Skala mit Makro-Skala gleichgesetzt), da kcal und Gramm keine
// vergleichbaren Einheiten sind und Makro-% strukturell über/unter kcal-%
// liegen kann, ohne dass das auf derselben Achse Sinn ergibt.
export default function MacroTrendChart({ macroTrend }) {
  const { kcal_goal, protein_goal, carb_ratio } = useSettings();
  const { carbs_goal, fat_goal } = computeMacroGoals({ kcal_goal, protein_goal, carb_ratio });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Makro-Verlauf</h2>
          <p className="text-sm text-slate-400">Letzte 10 Tage · kcal (Balken) vs. Makros in g (Linien)</p>
        </div>
        <TrendingUp className="h-5 w-5 text-orange-300" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={macroTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="kcal" stroke="#f97316" tick={{ fontSize: 11 }} unit=" kcal" />
            <YAxis yAxisId="g" orientation="right" stroke="#94a3b8" tick={{ fontSize: 11 }} unit="g" />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {kcal_goal ? (
              <ReferenceLine yAxisId="kcal" y={kcal_goal} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
            ) : null}
            {protein_goal ? (
              <ReferenceLine yAxisId="g" y={protein_goal} stroke="rgba(16,185,129,0.4)" strokeDasharray="4 4" />
            ) : null}
            {carbs_goal ? (
              <ReferenceLine yAxisId="g" y={carbs_goal} stroke="rgba(56,189,248,0.4)" strokeDasharray="4 4" />
            ) : null}
            {fat_goal ? (
              <ReferenceLine yAxisId="g" y={fat_goal} stroke="rgba(167,139,250,0.4)" strokeDasharray="4 4" />
            ) : null}
            <Bar yAxisId="kcal" dataKey="kcal" fill="#f97316" fillOpacity={0.35} name="kcal" radius={[4, 4, 0, 0]} />
            <Line yAxisId="g" type="monotone" dataKey="protein" stroke="#10b981" strokeWidth={2} dot={false} name="Protein (g)" />
            <Line yAxisId="g" type="monotone" dataKey="carbs" stroke="#38bdf8" strokeWidth={2} dot={false} name="Carbs (g)" />
            <Line yAxisId="g" type="monotone" dataKey="fat" stroke="#a78bfa" strokeWidth={2} dot={false} name="Fett (g)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
