import { TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useSettings } from "../../store.js";

export default function MacroTrendChart({ macroTrend }) {
  const { kcal_goal, protein_goal } = useSettings();
  const carbs_goal = kcal_goal ? Math.round(kcal_goal * 0.5 / 4) : 0;
  const fat_goal = kcal_goal ? Math.round(kcal_goal * 0.3 / 9) : 0;

  const trendPct = (macroTrend || []).map((d) => ({
    day: d.day,
    kcal: kcal_goal ? Math.round((d.kcal / kcal_goal) * 100) : 0,
    protein: protein_goal ? Math.round((d.protein / protein_goal) * 100) : 0,
    carbs: carbs_goal ? Math.round((d.carbs / carbs_goal) * 100) : 0,
    fat: fat_goal ? Math.round((d.fat / fat_goal) * 100) : 0,
  }));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Makro-Verlauf</h2>
          <p className="text-sm text-slate-400">Letzte 10 Tage</p>
        </div>
        <TrendingUp className="h-5 w-5 text-orange-300" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendPct}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit="%" domain={[0, 150]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              formatter={(v, name) => [`${v}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="kcal" stroke="#f97316" strokeWidth={2} dot={false} name="kcal" />
            <Line type="monotone" dataKey="protein" stroke="#10b981" strokeWidth={2} dot={false} name="Protein" />
            <Line type="monotone" dataKey="carbs" stroke="#38bdf8" strokeWidth={2} dot={false} name="Carbs" />
            <Line type="monotone" dataKey="fat" stroke="#a78bfa" strokeWidth={2} dot={false} name="Fat" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
