import { Flame } from "lucide-react";
import { useSettings } from "../../store.js";

export default function GoalsCard({ sectionCls, labelCls, inputCls }) {
  const { kcal_goal, protein_goal, water_goal, setSetting } = useSettings();

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Flame className="h-5 w-5 text-orange-300" />
        <h2 className="text-lg font-semibold">Tagesziele</h2>
      </div>
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
