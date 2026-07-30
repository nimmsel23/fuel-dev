import { Compass, ChevronDown, Utensils, HeartPulse, Activity } from "lucide-react";
import { useSettings } from "../../store.js";

// FuelMapFrame — zusätzliche Card NEBEN Account (AccountCard.jsx) und Profil
// (ProfileCard.jsx), kein Ersatz für beide. Enthält ausschließlich die
// ernährungsspezifische Anamnese, hinter einem Dropdown in thematische
// Domains gruppiert (Ernährungsform / Verträglichkeit / Gesundheit) statt
// einer flachen Feldliste — angelehnt an das AlphaOS Frame-Map-Muster
// (Domains statt Einzelfelder, "wo stehe ich gerade"), aber rein als
// UI-Struktur hier in fuel-dev, ohne echte AlphaOS-Anbindung.
// Alle Felder optional, dienen dem Coach als Kontext, kein Pflicht-Gate.

const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

function Domain({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Icon className="h-4 w-4 text-violet-300" />
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

export default function FuelMapFrame({ sectionCls, bare = false }) {
  const {
    nutrition_goal, diet_type, eating_pattern, intolerances, chronic_conditions, medications, digestive_notes,
    setSetting,
  } = useSettings();

  return (
    <section className={bare ? "grid gap-4" : sectionCls}>
      <details className="group rounded-2xl border border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-center gap-2 text-lg font-semibold">
            <Compass className="h-5 w-5 text-amber-300" />
            Ernährungs-Anamnese
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-white/10 p-4">
          <Domain icon={Utensils} title="Ernährungsform">
            <div>
              <label className={labelCls}>Ernährungsweise</label>
              <select value={diet_type} onChange={(e) => setSetting("diet_type", e.target.value)} className={inputCls}>
                <option value="omnivor">Omnivor</option>
                <option value="vegetarisch">Vegetarisch</option>
                <option value="vegan">Vegan</option>
                <option value="pescetarisch">Pescetarisch</option>
                <option value="low_carb">Low-Carb</option>
                <option value="keto">Keto</option>
                <option value="paleo">Paleo</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Aktuelles Ziel</label>
              <select value={nutrition_goal} onChange={(e) => setSetting("nutrition_goal", e.target.value)} className={inputCls}>
                <option value="abnehmen">Abnehmen</option>
                <option value="halten">Gewicht halten</option>
                <option value="zunehmen">Zunehmen</option>
                <option value="muskelaufbau">Muskelaufbau</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ess-Rhythmus</label>
              <select value={eating_pattern} onChange={(e) => setSetting("eating_pattern", e.target.value)} className={inputCls}>
                <option value="omad">OMAD (eine große Mahlzeit/Tag)</option>
                <option value="nomad">NOMAD (mehrere Mahlzeiten verteilt)</option>
                <option value="flexibel">Flexibel / unterschiedlich</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">Verhindert falsche "wenig geloggt"-Warnungen bei legitimen Ein-Mahlzeit-Tagen.</p>
            </div>
          </Domain>

          <Domain icon={HeartPulse} title="Verträglichkeit">
            <div>
              <label className={labelCls}>Unverträglichkeiten / Allergien</label>
              <textarea rows={2} value={intolerances} placeholder="z.B. Laktose, Histamin, Nüsse"
                onChange={(e) => setSetting("intolerances", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Verdauung / Beschwerden</label>
              <textarea rows={2} value={digestive_notes} placeholder="z.B. Reizdarm, Blähungen nach Milchprodukten"
                onChange={(e) => setSetting("digestive_notes", e.target.value)} className={inputCls} />
            </div>
          </Domain>

          <Domain icon={Activity} title="Gesundheit">
            <div>
              <label className={labelCls}>Chronische Erkrankungen</label>
              <textarea rows={2} value={chronic_conditions} placeholder="z.B. Diabetes Typ 2, Bluthochdruck"
                onChange={(e) => setSetting("chronic_conditions", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Medikamente (ernährungsrelevant)</label>
              <textarea rows={2} value={medications} placeholder="z.B. Metformin, Blutverdünner"
                onChange={(e) => setSetting("medications", e.target.value)} className={inputCls} />
            </div>
          </Domain>

          <p className="text-xs text-slate-500">Alle Felder optional — dienen als Kontext für Coach-Auswertungen, keine Pflichtangabe.</p>
        </div>
      </details>
    </section>
  );
}
