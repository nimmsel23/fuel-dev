import { Activity, Leaf, NotebookPen, TrendingUp, UtensilsCrossed, Waves } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, GoalBar, MealRow, Empty } from "../components/ui.jsx";
import { useSettings } from "../store.js";
import { sumMetric, formatMetric } from "../lib/utils.js";

export default function DashboardView({ nutrition, sup, journal, macroTrend }) {
  const meals = nutrition?.meals || [];
  const streak = sup?.stats?.[0]?.current_streak || 0;
  const totalKcal = sumMetric(meals, "kcal");
  const totalProtein = sumMetric(meals, "protein");
  const { kcal_goal, protein_goal, water_goal } = useSettings();
  const waterMl = nutrition?.water_ml || 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={UtensilsCrossed} title="Meals" value={meals.length} hint="heutige Einträge" />
          <Card icon={Activity} title="Protein" value={`${formatMetric(totalProtein)} g`} hint="aus allen Meals des Tages" />
          <Card icon={Waves} title="Water" value={`${waterMl} ml`} hint="Tageshydration" />
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Tagesziele</h2>
          <div className="grid gap-3">
            <GoalBar label="Kalorien" value={totalKcal} goal={kcal_goal} unit=" kcal" color="bg-orange-400" />
            <GoalBar label="Protein" value={totalProtein} goal={protein_goal} unit="g" color="bg-emerald-400" />
            <GoalBar label="Wasser" value={waterMl} goal={water_goal} unit=" ml" color="bg-sky-400" />
          </div>
        </section>

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
              <LineChart data={macroTrend || []} margin={{ right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="macros" stroke="#94a3b8" tick={{ fontSize: 11 }} unit="g" />
                <YAxis yAxisId="kcal" orientation="right" stroke="#f97316" tick={{ fontSize: 11, fill: "#f97316" }} unit=" kcal" />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="kcal"   type="monotone" dataKey="kcal"    stroke="#f97316" strokeWidth={2} dot={false} name="kcal" />
                <Line yAxisId="macros" type="monotone" dataKey="protein"  stroke="#10b981" strokeWidth={2} dot={false} name="Protein g" />
                <Line yAxisId="macros" type="monotone" dataKey="carbs"    stroke="#38bdf8" strokeWidth={2} dot={false} name="Carbs g" />
                <Line yAxisId="macros" type="monotone" dataKey="fat"      stroke="#a78bfa" strokeWidth={2} dot={false} name="Fat g" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <aside className="grid gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold">Today</h2>
          </div>
          <div className="space-y-3">
            {meals.length ? meals.map((meal) => <MealRow key={meal.id} meal={meal} />) : <Empty text="Keine Mahlzeiten geloggt" />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-5 w-5 text-sky-300" />
              <h2 className="text-lg font-semibold">Journal</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              streak {streak}d
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">{journal || "Kein Journaleintrag geladen."}</p>
        </section>
      </aside>
    </div>
  );
}
