import { Activity } from "lucide-react";
import { useSettings } from "../../store.js";

export default function ProfileCard({ sectionCls, labelCls, inputCls }) {
  const { age, gender, setSetting } = useSettings();

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-emerald-300" />
        <h2 className="text-lg font-semibold">Profil</h2>
      </div>
      <div className="grid gap-3">
        <div>
          <label className={labelCls}>Alter</label>
          <input
            type="number" value={age} min={15} max={99}
            onChange={e => setSetting("age", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Geschlecht</label>
          <select
            value={gender}
            onChange={e => setSetting("gender", e.target.value)}
            className={inputCls}
          >
            <option value="m">Männlich</option>
            <option value="f">Weiblich</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">Wird für DACH-Referenzwerte im Mikros-Tab verwendet.</p>
      </div>
    </section>
  );
}
