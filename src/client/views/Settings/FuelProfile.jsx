import { Utensils, HeartPulse, Activity, Gauge, ScanSearch, ChevronDown } from "lucide-react";
import { useSettings } from "../../store.js";

// FuelProfile — läuft optisch direkt an ProfileCard.jsx an (auf
// User-Wunsch 2026-07-31 Teil von Profil, wo auch Größe/Gewicht stehen).
// Alles hier sind schlichte Ernährungs-Anamnese-Felder, kein "Frame"/
// Snapshot-Konzept — jedes Feld speichert automatisch über setSetting()
// (wie der Rest der App), es gibt keinen Save-Button und keine Historie.
// Basis-Felder (Ernährungsform / Verträglichkeit / Gesundheit) sind immer
// sichtbar, die selteneren Detail-Felder (Aktuelle Situation / Review)
// stecken hinter einem "Weitere Details"-Accordion, rein aus Platzgründen.
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

export default function FuelProfile({ sectionCls, bare = false }) {
  const {
    nutrition_goal, diet_type, eating_pattern, weight_goal, nutrition_focus,
    energy_level, hunger_notes, nutrition_satisfaction,
    intolerances, chronic_conditions, medications, digestive_notes,
    nutrition_working, nutrition_not_working,
    setSetting,
  } = useSettings();

  return (
    <section className={bare ? "grid gap-4" : sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Utensils className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-semibold">Ernährungsprofil</h2>
      </div>
      <div className="grid gap-3">
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
              <option value="nomad">NOMAD — No Meal A Day (Langzeitfasten, z.B. 24h+)</option>
              <option value="multiple">Mehrere Mahlzeiten verteilt</option>
              <option value="flexibel">Flexibel / unterschiedlich</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Verhindert falsche "wenig geloggt"-Warnungen bei legitimen Ein-Mahlzeit- oder Fasten-Tagen.</p>
          </div>
          <div>
            <label className={labelCls}>Gewichtsziel</label>
            <select value={weight_goal} onChange={(e) => setSetting("weight_goal", e.target.value)} className={inputCls}>
              <option value="">Keine Angabe</option>
              <option value="lose">Gewicht reduzieren</option>
              <option value="maintain">Gewicht halten</option>
              <option value="gain">Gewicht erhöhen</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Ernährungsfokus</label>
            <select value={nutrition_focus} onChange={(e) => setSetting("nutrition_focus", e.target.value)} className={inputCls}>
              <option value="">Keine Angabe</option>
              <option value="muscle_gain">Muskelaufbau</option>
              <option value="performance">Leistungsfähigkeit</option>
              <option value="health">Gesundheit / Prävention</option>
              <option value="digestion">Verdauung / Verträglichkeit</option>
              <option value="balanced">Ausgewogene Ernährung</option>
            </select>
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

      <details className="group mt-4 rounded-2xl border border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            Weitere Details
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-white/10 p-4">
          <Domain icon={Gauge} title="Aktuelle Situation">
            <div>
              <label className={labelCls}>Energie / Leistungsfähigkeit</label>
              <select value={energy_level} onChange={(e) => setSetting("energy_level", e.target.value)} className={inputCls}>
                <option value="">Keine Angabe</option>
                <option value="low">Eher niedrig</option>
                <option value="variable">Schwankend</option>
                <option value="good">Gut</option>
                <option value="high">Sehr gut</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Hunger / Sättigung</label>
              <textarea rows={2} value={hunger_notes} placeholder="z.B. starker Abendhunger, kaum Frühstückshunger, häufige Heißhungerphasen"
                onChange={(e) => setSetting("hunger_notes", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Zufriedenheit mit der Ernährung</label>
              <select value={nutrition_satisfaction} onChange={(e) => setSetting("nutrition_satisfaction", e.target.value)} className={inputCls}>
                <option value="">Keine Angabe</option>
                <option value="poor">Unzufrieden</option>
                <option value="mixed">Durchwachsen</option>
                <option value="good">Zufrieden</option>
                <option value="very_good">Sehr zufrieden</option>
              </select>
            </div>
          </Domain>

          <Domain icon={ScanSearch} title="Review">
            <div>
              <label className={labelCls}>Was funktioniert aktuell gut?</label>
              <textarea rows={3} value={nutrition_working} placeholder="Welche Routinen, Lebensmittel oder Strategien funktionieren bereits?"
                onChange={(e) => setSetting("nutrition_working", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Was funktioniert aktuell nicht?</label>
              <textarea rows={3} value={nutrition_not_working} placeholder="Wo entstehen Probleme, Rückfälle oder Hindernisse?"
                onChange={(e) => setSetting("nutrition_not_working", e.target.value)} className={inputCls} />
            </div>
          </Domain>
        </div>
      </details>
    </section>
  );
}
