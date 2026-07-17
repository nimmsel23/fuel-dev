import { GoalBar } from "../../components/ui.jsx";
import { useSettings } from "../../store.js";

export default function DailyGoals({ totalKcal, totalProtein, waterMl }) {
  const { kcal_goal, protein_goal, water_goal } = useSettings();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold">Tagesziele</h2>
      <div className="grid gap-3">
        <GoalBar label="Kalorien" value={totalKcal} goal={kcal_goal} unit=" kcal" color="bg-orange-400" />
        <GoalBar label="Protein" value={totalProtein} goal={protein_goal} unit="g" color="bg-emerald-400" />
        <GoalBar label="Wasser" value={waterMl} goal={water_goal} unit=" ml" color="bg-sky-400" />
      </div>
    </section>
  );
}
