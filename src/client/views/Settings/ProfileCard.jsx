import { Activity } from "lucide-react";
import { useSettings } from "../../store.js";

// bare=true: nur die interne Grid-Struktur, kein eigener Rahmen/Hintergrund
// — für den Fall, dass ein Elternteil (SettingsView) mehrere Cards visuell
// zu einer zusammenfassen will, ohne die Komponenten selbst zu verschmelzen.
export default function ProfileCard({ sectionCls, labelCls, inputCls, bare = false }) {
  const { age, gender, height_cm, weight_kg, setSetting } = useSettings();

  return (
    <section className={bare ? "grid gap-4" : sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-emerald-300" />
        <h2 className="text-lg font-semibold">Profil</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className={labelCls}>Größe (cm)</label>
          <input
            type="number" value={height_cm} min={100} max={230}
            onChange={e => setSetting("height_cm", Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Gewicht (kg)</label>
          <input
            type="number" value={weight_kg} min={30} max={250}
            onChange={e => setSetting("weight_kg", Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">Alter/Geschlecht für DACH-Referenzwerte im Mikros-Tab, Größe/Gewicht für Kalorien-/Protein-Ziele.</p>
    </section>
  );
}
