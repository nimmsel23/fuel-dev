import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Utensils, HeartPulse, Activity, Gauge, ScanSearch, Archive, Loader2, ChevronDown } from "lucide-react";
import { fetchJson, postJson } from "@api";
import { useSettings } from "../../store.js";

// FuelProfile — läuft optisch direkt an ProfileCard.jsx an (auf
// User-Wunsch 2026-07-31 Teil von Profil, wo auch Größe/Gewicht stehen).
// Die Basis-Anamnese (Ernährungsform / Verträglichkeit / Gesundheit) ist
// immer sichtbar. Das eigentlich NEUE — Aktuelle Situation, Review und der
// "Frame abschließen"-Snapshot nach users/{uid}/fuelFrames/{frameId} (siehe
// lib/db/firestore/frames.js / server/lib/firestore-admin.mjs#pushFuelFrame)
// — steckt bewusst hinter einem Accordion: das ist das tiefere,
// verlaufsbezogene Tracking, kein Basisfeld (User-Feedback: Accordion war
// als generelles Versteck störend, für genau diesen Teil aber passend).
// Alle Felder optional, dienen dem Coach als Kontext, kein Pflicht-Gate.

const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

// Nur diese Felder wandern in einen Frame-Snapshot — kein
// kcal_goal/protein_goal etc. (die gehören zu GoalsCard, ändern sich viel
// häufiger und sind kein Teil der Anamnese).
const FRAME_FIELD_KEYS = [
  "diet_type", "nutrition_goal", "weight_goal", "nutrition_focus", "eating_pattern",
  "energy_level", "hunger_notes", "nutrition_satisfaction",
  "intolerances", "digestive_notes",
  "chronic_conditions", "medications",
  "nutrition_working", "nutrition_not_working",
];

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

function formatFrameDate(frame) {
  const raw = frame.created_at;
  if (!raw) return "";
  // Firestore Admin (lokal) speichert ISO-String, Client-SDK ein Timestamp-Objekt.
  const d = typeof raw === "string" ? new Date(raw) : raw.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function FrameHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["fuel-frames"],
    queryFn: async () => {
      const res = await fetchJson("/nutrition/frames?limit=20");
      return res.frames || [];
    },
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-xs text-slate-500">Lade Frame-Historie…</p>;
  if (!data?.length) return <p className="text-xs text-slate-500">Noch kein Frame abgeschlossen.</p>;

  return (
    <div className="grid gap-2">
      {data.map((frame, i) => (
        <div key={frame.id} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <strong className="text-slate-200">FRAME {String(data.length - i).padStart(2, "0")}</strong>
            <span className="text-xs text-slate-500">{formatFrameDate(frame)}</span>
          </div>
          {frame.nutrition_working && (
            <p className="mt-1 text-xs text-emerald-300/80">+ {frame.nutrition_working}</p>
          )}
          {frame.nutrition_not_working && (
            <p className="text-xs text-rose-300/80">- {frame.nutrition_not_working}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FuelProfile({ sectionCls, bare = false }) {
  const settings = useSettings();
  const {
    nutrition_goal, diet_type, eating_pattern, weight_goal, nutrition_focus,
    energy_level, hunger_notes, nutrition_satisfaction,
    intolerances, chronic_conditions, medications, digestive_notes,
    nutrition_working, nutrition_not_working,
    setSetting,
  } = settings;
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function completeFrame() {
    setSaving(true);
    setError("");
    try {
      const frame = Object.fromEntries(FRAME_FIELD_KEYS.map((k) => [k, settings[k] ?? ""]));
      await postJson("/nutrition/frame", { frame });
      queryClient.invalidateQueries({ queryKey: ["fuel-frames"] });
      setShowHistory(true);
    } catch (e) {
      setError(e.message || "Frame konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

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
            <Archive className="h-4 w-4 text-amber-300" />
            Fuel Frame — Verlaufs-Tracking
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

          <Domain icon={ScanSearch} title="Frame Review">
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

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Archive className="h-4 w-4" />
                Frame abschließen
              </div>
              <button
                type="button"
                onClick={completeFrame}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Speichert…" : "Jetzt abschließen"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Friert den aktuellen Anamnese-Stand als unveränderlichen Snapshot ein — erlaubt später den Vergleich
              "FRAME 01 → FRAME 02" (was hat sich verändert, was hat funktioniert).
            </p>
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="mt-3 text-xs text-amber-300 underline underline-offset-2"
            >
              {showHistory ? "Historie ausblenden" : "Frame-Historie anzeigen"}
            </button>
            {showHistory && <div className="mt-3"><FrameHistory /></div>}
          </div>
        </div>
      </details>
    </section>
  );
}
